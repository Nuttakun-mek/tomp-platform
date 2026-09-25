import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { deletePreviewItem, getPreviewItem, isWebPreview, setPreviewItem } from "./preview-storage";

const INSTALLATION_ID_KEY = "tomp_driver_installation_id";
const MOBILE_SESSION_KEY = "tomp_driver_mobile_session_v2";
const LEGACY_MOBILE_SESSION_KEYS = ["tomp_driver_mobile_session"];
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
};

let cachedMobileSession: MobileDriverSession | null | undefined;

export interface MobileDriverSession {
  session: string;
  expiresAt: string;
}

function createUuidFallback() {
  return `install-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getInstallationId() {
  const preview = await getPreviewItem(INSTALLATION_ID_KEY);
  if (preview) return preview;

  if (isWebPreview()) {
    const generated =
      typeof Crypto.randomUUID === "function" ? Crypto.randomUUID() : createUuidFallback();
    await setPreviewItem(INSTALLATION_ID_KEY, generated);
    return generated;
  }

  const existing = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
  if (existing) return existing;

  const generated =
    typeof Crypto.randomUUID === "function" ? Crypto.randomUUID() : createUuidFallback();
  if (await setPreviewItem(INSTALLATION_ID_KEY, generated)) return generated;
  await SecureStore.setItemAsync(INSTALLATION_ID_KEY, generated);
  return generated;
}

export async function saveMobileDriverSession(input: MobileDriverSession) {
  cachedMobileSession = input;
  if (await setPreviewItem(MOBILE_SESSION_KEY, JSON.stringify(input))) return;
  await SecureStore.setItemAsync(MOBILE_SESSION_KEY, JSON.stringify(input), SECURE_STORE_OPTIONS);
}

export async function getMobileDriverSession(): Promise<MobileDriverSession | null> {
  if (cachedMobileSession && new Date(cachedMobileSession.expiresAt).getTime() > Date.now()) {
    return cachedMobileSession;
  }

  const preview = await getPreviewItem(MOBILE_SESSION_KEY);
  const raw = preview ?? (isWebPreview() ? null : await SecureStore.getItemAsync(MOBILE_SESSION_KEY));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MobileDriverSession;
    if (!parsed.session || !parsed.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      await clearMobileDriverSession();
      return null;
    }
    cachedMobileSession = parsed;
    // Re-save older sessions with the background-safe keychain accessibility.
    if (!isWebPreview()) await SecureStore.setItemAsync(MOBILE_SESSION_KEY, raw, SECURE_STORE_OPTIONS).catch(() => undefined);
    return parsed;
  } catch {
    return null;
  }
}

export async function clearLegacyMobileDriverSessions() {
  if (isWebPreview()) {
    await Promise.all(LEGACY_MOBILE_SESSION_KEYS.map((key) => deletePreviewItem(key)));
    return;
  }
  await Promise.all(LEGACY_MOBILE_SESSION_KEYS.map((key) => SecureStore.deleteItemAsync(key).catch(() => undefined)));
}

export async function clearMobileDriverSession() {
  cachedMobileSession = null;
  if (isWebPreview()) {
    await Promise.all([
      deletePreviewItem(MOBILE_SESSION_KEY),
      clearLegacyMobileDriverSessions()
    ]);
    return;
  }
  await Promise.all([
    SecureStore.deleteItemAsync(MOBILE_SESSION_KEY).catch(() => undefined),
    clearLegacyMobileDriverSessions()
  ]);
}
