import { newTrackingId } from "../lib/tracking-id";
import { getCachedServerBaseUrl } from "./server-config-cache";
import type { RegisterEmailResponse } from "../lib/messages";

const PROCESSED_ATTR = "data-mt-processed";
const TRACKING_ON_ATTR = "data-mt-tracking-on";
const INJECTED_ATTR = "data-mt-injected";

/**
 * Gmail has no stable IDs or class names (they're minified and change across
 * deploys), so every selector below is written against ARIA labels /
 * contenteditable roles, which Gmail keeps stable for accessibility. This is
 * the same fragility real Mailtrack has to live with.
 *
 * We scan for message-body elements directly rather than for role="dialog"
 * wrappers: that role only wraps the popup "new message" window. Gmail's
 * inline reply box (expanded directly under a message in a thread, not
 * popped out) has no dialog wrapper at all, so anchoring on the dialog role
 * silently skipped every reply sent that way.
 */
export function observeComposeWindows(): void {
  const observer = new MutationObserver(() => {
    document
      .querySelectorAll<HTMLElement>(
        'div[aria-label="Message Body"][contenteditable="true"], div[g_editable="true"][contenteditable="true"]',
      )
      .forEach((body) => {
        if (body.hasAttribute(PROCESSED_ATTR)) return;

        const surface = findComposeSurface(body);
        if (!surface) return;

        body.setAttribute(PROCESSED_ATTR, "true");
        setupComposeWindow(surface.container, body, surface.sendButton);
      });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function findComposeSurface(
  body: HTMLElement,
): { container: HTMLElement; sendButton: HTMLElement } | null {
  const dialog = body.closest<HTMLElement>('div[role="dialog"]');
  if (dialog) {
    const sendButton = findSendButton(dialog);
    if (sendButton) return { container: dialog, sendButton };
  }

  // Inline replies aren't wrapped in role="dialog", so walk up a bounded
  // number of ancestors looking for the nearest one containing a Send button.
  let container = body.parentElement;
  for (let i = 0; i < 20 && container; i++) {
    const sendButton = findSendButton(container);
    if (sendButton) return { container, sendButton };
    container = container.parentElement;
  }
  return null;
}

function findSendButton(container: HTMLElement): HTMLElement | null {
  const candidates = container.querySelectorAll<HTMLElement>('div[role="button"]');
  for (const el of candidates) {
    const label = (el.getAttribute("aria-label") ?? el.getAttribute("data-tooltip") ?? "").toLowerCase();
    if (label.startsWith("send")) return el;
  }
  return null;
}

function setupComposeWindow(container: HTMLElement, body: HTMLElement, sendButton: HTMLElement): void {
  container.setAttribute(TRACKING_ON_ATTR, "true");

  const toggle = createToggleButton(container);
  sendButton.parentElement?.insertBefore(toggle, sendButton);

  // Capture phase so we mutate the body before Gmail's own listener (attached
  // during its own render) reads it and serializes the outgoing message.
  sendButton.addEventListener("click", () => handleSend(container, body), true);
  body.addEventListener(
    "keydown",
    (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        handleSend(container, body);
      }
    },
    true,
  );
}

function createToggleButton(container: HTMLElement): HTMLElement {
  const button = document.createElement("div");
  button.setAttribute("role", "button");
  button.title = "Tracking is ON for this email (click to toggle)";
  button.textContent = "\u{1F441}️"; // 👁️
  button.style.cursor = "pointer";
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.padding = "0 6px";
  button.style.opacity = "1";
  button.style.userSelect = "none";
  // Gmail's inline-reply toolbar is a tighter flex row than the popup
  // compose one and was wrapping this onto its own line without these -
  // pin it to its natural size instead of letting the row's flex-shrink
  // squeeze or drop it.
  button.style.flex = "0 0 auto";
  button.style.whiteSpace = "nowrap";

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const isOn = container.getAttribute(TRACKING_ON_ATTR) === "true";
    container.setAttribute(TRACKING_ON_ATTR, String(!isOn));
    button.style.opacity = isOn ? "0.35" : "1";
    button.title = `Tracking is ${isOn ? "OFF" : "ON"} for this email (click to toggle)`;
  });

  return button;
}

function handleSend(container: HTMLElement, body: HTMLElement): void {
  if (container.getAttribute(TRACKING_ON_ATTR) !== "true") return;
  if (container.getAttribute(INJECTED_ATTR) === "true") return; // click + keydown can both fire for one send
  container.setAttribute(INJECTED_ATTR, "true");

  const trackingId = newTrackingId();
  const baseUrl = getCachedServerBaseUrl();

  rewriteLinks(body, trackingId, baseUrl);
  appendPixel(body, trackingId, baseUrl);

  const subject = extractSubject(container);
  const sender = extractSender();
  const recipients = extractRecipients(container);
  const isReply = !container.querySelector('input[name="subjectbox"]');

  chrome.runtime.sendMessage(
    { type: "REGISTER_EMAIL", payload: { trackingId, subject, sender, recipients, isReply } },
    (_response: RegisterEmailResponse) => void chrome.runtime.lastError, // swallow "no receiver" noise
  );
}

const BARE_URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

function trackingUrl(baseUrl: string, trackingId: string, original: string): string {
  return `${baseUrl}/c/${trackingId}?u=${encodeURIComponent(original)}`;
}

function rewriteLinks(body: HTMLElement, trackingId: string, baseUrl: string): void {
  // Case 1: Gmail already auto-linkified the URL into a real <a href>.
  body.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const original = anchor.href;
    if (!original.startsWith("http://") && !original.startsWith("https://")) return;
    anchor.href = trackingUrl(baseUrl, trackingId, original);
  });

  // Case 2: Gmail only auto-linkifies on triggers like space/newline/blur, so
  // a pasted URL sent immediately can still be plain text at this point.
  // Wrap any remaining bare URLs ourselves so they don't slip out untracked.
  wrapBareUrls(body, trackingId, baseUrl);
}

function wrapBareUrls(root: HTMLElement, trackingId: string, baseUrl: string): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement?.closest("a")) return NodeFilter.FILTER_REJECT;
      // Fresh non-global regex per check: BARE_URL_PATTERN is a shared `g`
      // regex reused below in matchAll(), and calling .test() on a shared
      // global regex mutates its lastIndex, which would corrupt later calls.
      return /https?:\/\//.test(node.textContent ?? "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });

  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  for (const textNode of textNodes) {
    const text = textNode.textContent ?? "";
    const frag = document.createDocumentFragment();
    let lastIndex = 0;

    for (const match of text.matchAll(BARE_URL_PATTERN)) {
      const url = match[0];
      const index = match.index ?? 0;
      if (index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, index)));

      const anchor = document.createElement("a");
      anchor.href = trackingUrl(baseUrl, trackingId, url);
      anchor.textContent = url;
      frag.appendChild(anchor);

      lastIndex = index + url.length;
    }
    if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));

    textNode.parentNode?.replaceChild(frag, textNode);
  }
}

function appendPixel(body: HTMLElement, trackingId: string, baseUrl: string): void {
  const img = document.createElement("img");
  img.src = `${baseUrl}/p/${trackingId}.png`;
  img.width = 1;
  img.height = 1;
  img.style.display = "none";
  body.appendChild(img);
}

function extractSender(): string {
  // Gmail's account-switcher button always carries the signed-in address,
  // e.g. aria-label="Google Account: Prakhar Rai  \n(prakhar.tools@gmail.com)".
  // This doesn't account for a "Send mail as" alias picked in a multi-identity
  // compose, which Gmail doesn't expose through a selector stable enough to
  // rely on here.
  const account = document.querySelector<HTMLElement>('a[aria-label^="Google Account:"]');
  const match = account?.getAttribute("aria-label")?.match(/\(([^)]+@[^)]+)\)/);
  return match?.[1] ?? "";
}

function extractSubject(container: HTMLElement): string {
  const input = container.querySelector<HTMLInputElement>('input[name="subjectbox"]');
  if (input?.value?.trim()) return input.value.trim();

  // Inline replies show no subject field (Gmail reuses the thread's
  // subject). While a thread is open, document.title is
  // "<subject> - <sender> - <account> - Gmail", so recover it from there.
  const fromTitle = document.title.split(" - ")[0]?.trim();
  return fromTitle && fromTitle !== "Gmail" ? fromTitle : "(no subject)";
}

function extractRecipients(container: HTMLElement): string {
  const chips = collectRecipientChips(container);
  if (chips.length > 0) return chips.join(", ");

  const fallback = container.querySelector<HTMLTextAreaElement>('textarea[name="to"]');
  return fallback?.value?.trim() || "(unknown recipient)";
}

function collectRecipientChips(container: HTMLElement): string[] {
  // Popup compose keeps the recipient chips inside the same container as the
  // Send button; Gmail's inline reply keeps its (collapsed) "to" header a
  // few levels further up than where the Send-button search stops, so widen
  // the search rather than assuming they're co-located.
  let scope: HTMLElement | null = container;
  for (let i = 0; i < 10 && scope; i++) {
    const chips = Array.from(scope.querySelectorAll<HTMLElement>("span[email]"))
      .map((el) => el.getAttribute("email"))
      .filter((email): email is string => Boolean(email));
    if (chips.length > 0) return Array.from(new Set(chips));
    scope = scope.parentElement;
  }
  return [];
}
