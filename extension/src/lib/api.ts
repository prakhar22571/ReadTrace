import { getApiKey, getServerBaseUrl } from "./config";
import type { TrackedEmail } from "./messages";

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const [baseUrl, apiKey] = await Promise.all([getServerBaseUrl(), getApiKey()]);
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "X-Api-Key": apiKey,
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const REGISTER_RETRY_DELAYS_MS = [500, 1500];

/**
 * The pixel/links are already baked into the email by the time this fires,
 * so a transient failure here (cold-start hiccup, dropped connection) would
 * otherwise strand the email untracked with no way to retry later. Only
 * retries on network failures / 5xx - a 4xx (e.g. bad API key) won't be
 * fixed by trying again.
 */
export async function registerEmail(payload: {
  trackingId: string;
  subject: string;
  sender: string;
  recipients: string;
  isReply: boolean;
}): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= REGISTER_RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(REGISTER_RETRY_DELAYS_MS[attempt - 1]);

    let res: Response;
    try {
      res = await authedFetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      lastError = err; // network failure - worth retrying
      continue;
    }

    if (res.ok) return;
    if (res.status < 500) throw new Error(`registerEmail failed: ${res.status}`); // not retryable, bail now
    lastError = new Error(`registerEmail failed: ${res.status}`); // 5xx - worth retrying
  }

  throw lastError;
}

export async function fetchTrackedEmails(): Promise<TrackedEmail[]> {
  const res = await authedFetch("/api/emails");
  if (!res.ok) {
    throw new Error(`fetchTrackedEmails failed: ${res.status}`);
  }
  const data = (await res.json()) as { emails: TrackedEmail[] };
  return data.emails;
}
