export const STORAGE_KEYS = {
  apiKey: "mt_api_key",
  serverBaseUrl: "mt_server_base_url",
  trackingEnabledByDefault: "mt_tracking_enabled_default",
  notificationsEnabled: "mt_notifications_enabled",
} as const;

export const DEFAULT_SERVER_BASE_URL = "http://127.0.0.1:8787";

export async function getServerBaseUrl(): Promise<string> {
  const data = await chrome.storage.sync.get(STORAGE_KEYS.serverBaseUrl);
  const url = data[STORAGE_KEYS.serverBaseUrl];
  return typeof url === "string" && url.length > 0
    ? url.replace(/\/+$/, "")
    : DEFAULT_SERVER_BASE_URL;
}

/** Must match the API_KEY secret set on the backend (`wrangler secret put API_KEY`); set in Settings. */
export async function getApiKey(): Promise<string> {
  const data = await chrome.storage.sync.get(STORAGE_KEYS.apiKey);
  const key = data[STORAGE_KEYS.apiKey];
  return typeof key === "string" ? key : "";
}

export async function isTrackingEnabledByDefault(): Promise<boolean> {
  const data = await chrome.storage.sync.get(
    STORAGE_KEYS.trackingEnabledByDefault,
  );
  const value = data[STORAGE_KEYS.trackingEnabledByDefault];
  return typeof value === "boolean" ? value : true;
}

export async function areNotificationsEnabled(): Promise<boolean> {
  const data = await chrome.storage.sync.get(
    STORAGE_KEYS.notificationsEnabled,
  );
  const value = data[STORAGE_KEYS.notificationsEnabled];
  return typeof value === "boolean" ? value : true;
}
