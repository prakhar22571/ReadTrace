import { STORAGE_KEYS, DEFAULT_SERVER_BASE_URL } from "../lib/config";

const serverUrlInput = document.getElementById("server-url") as HTMLInputElement;
const apiKeyInput = document.getElementById("api-key") as HTMLInputElement;
const trackingDefaultInput = document.getElementById("tracking-default") as HTMLInputElement;
const notificationsInput = document.getElementById("notifications-enabled") as HTMLInputElement;
const saveButton = document.getElementById("save") as HTMLButtonElement;
const savedLabel = document.getElementById("saved") as HTMLSpanElement;

async function load(): Promise<void> {
  const data = await chrome.storage.sync.get([
    STORAGE_KEYS.serverBaseUrl,
    STORAGE_KEYS.apiKey,
    STORAGE_KEYS.trackingEnabledByDefault,
    STORAGE_KEYS.notificationsEnabled,
  ]);

  serverUrlInput.value = data[STORAGE_KEYS.serverBaseUrl] ?? DEFAULT_SERVER_BASE_URL;
  apiKeyInput.value = data[STORAGE_KEYS.apiKey] ?? "";
  trackingDefaultInput.checked = data[STORAGE_KEYS.trackingEnabledByDefault] ?? true;
  notificationsInput.checked = data[STORAGE_KEYS.notificationsEnabled] ?? true;
}

saveButton.addEventListener("click", async () => {
  await chrome.storage.sync.set({
    [STORAGE_KEYS.serverBaseUrl]: serverUrlInput.value.trim().replace(/\/+$/, ""),
    [STORAGE_KEYS.apiKey]: apiKeyInput.value.trim(),
    [STORAGE_KEYS.trackingEnabledByDefault]: trackingDefaultInput.checked,
    [STORAGE_KEYS.notificationsEnabled]: notificationsInput.checked,
  });
  savedLabel.textContent = "Saved.";
  setTimeout(() => (savedLabel.textContent = ""), 2000);
});

void load();
