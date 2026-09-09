import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const INSTALLATION_ID_KEY = "tomp_driver_installation_id";
const MOBILE_SESSION_KEY = "tomp_driver_mobile_session";

export interface MobileDriverSession {
  session: string;
  expiresAt: string;
}

function createUuidFallback() {
  return `install-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getInstallationId() {
  const existing = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
  if (existing) return existing;

  const generated =
    typeof Crypto.randomUUID === "function" ? Crypto.randomUUID() : createUuidFallback();
  await SecureStore.setItemAsync(INSTALLATION_ID_KEY, generated);
  return generated;
}

export async function saveMobileDriverSession(input: MobileDriverSession) {
  await SecureStore.setItemAsync(MOBILE_SESSION_KEY, JSON.stringify(input));
}

export async function getMobileDriverSession(): Promise<MobileDriverSession | null> {
  const raw = await SecureStore.getItemAsync(MOBILE_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MobileDriverSession;
    if (!parsed.session || !parsed.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      await clearMobileDriverSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearMobileDriverSession() {
  await SecureStore.deleteItemAsync(MOBILE_SESSION_KEY);
}
