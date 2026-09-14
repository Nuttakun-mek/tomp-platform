import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "tomp_driver_token_v2";
const LEGACY_TOKEN_KEYS = ["tomp_driver_token"];

export async function saveDriverToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getSavedDriverToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearLegacyDriverTokens() {
  await Promise.all(LEGACY_TOKEN_KEYS.map((key) => SecureStore.deleteItemAsync(key).catch(() => undefined)));
}

export async function clearDriverToken() {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined),
    clearLegacyDriverTokens()
  ]);
}
