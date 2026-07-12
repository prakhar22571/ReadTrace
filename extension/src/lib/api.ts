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

export async function registerEmail(payload: {
  trackingId: string;
  subject: string;
  sender: string;
  recipients: string;
  isReply: boolean;
}): Promise<void> {
  const res = await authedFetch("/api/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`registerEmail failed: ${res.status}`);
  }
}

export async function fetchTrackedEmails(): Promise<TrackedEmail[]> {
  const res = await authedFetch("/api/emails");
  if (!res.ok) {
    throw new Error(`fetchTrackedEmails failed: ${res.status}`);
  }
  const data = (await res.json()) as { emails: TrackedEmail[] };
  return data.emails;
}
