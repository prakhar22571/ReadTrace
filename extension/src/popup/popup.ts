import type { GetEmailsResponse, TrackedEmail } from "../lib/messages";

const statusEl = document.getElementById("status") as HTMLDivElement;
const listEl = document.getElementById("email-list") as HTMLUListElement;
const optionsLink = document.getElementById("options-link") as HTMLAnchorElement;

optionsLink.addEventListener("click", (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});

chrome.runtime.sendMessage({ type: "GET_EMAILS" }, (response: GetEmailsResponse | undefined) => {
  if (chrome.runtime.lastError || !response) {
    statusEl.textContent = "Could not reach the extension background worker.";
    return;
  }
  if (!response.ok) {
    statusEl.textContent = `Error: ${response.error}. Check your server URL in Settings.`;
    return;
  }
  render(response.emails);
});

function render(emails: TrackedEmail[]): void {
  if (emails.length === 0) {
    statusEl.textContent = "No tracked emails yet. Send an email from Gmail with tracking on.";
    return;
  }

  statusEl.textContent = `${emails.length} tracked email${emails.length === 1 ? "" : "s"}`;

  for (const email of emails) {
    const li = document.createElement("li");
    li.className = "email-item";

    const subject = document.createElement("div");
    subject.className = "email-subject";
    subject.textContent = email.subject;

    const meta = document.createElement("div");
    meta.className = "email-meta";
    const from = email.sender ? `${email.sender} → ` : "";
    const replyTag = email.isReply ? " (reply)" : "";
    meta.textContent = `${from}${email.recipients}${replyTag} · ${new Date(email.sentAt).toLocaleString()}`;

    const status = document.createElement("div");
    const opened = email.openCount > 0;
    status.className = `email-status ${opened ? "status-opened" : "status-unopened"}`;
    status.textContent = opened
      ? `✓✓ Opened ${email.openCount}x${email.clickCount > 0 ? ` · ${email.clickCount} click(s)` : ""}`
      : "✓ Sent, not opened yet";

    li.append(subject, meta, status);
    listEl.appendChild(li);
  }
}
