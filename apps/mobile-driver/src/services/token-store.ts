import * as SecureStore from "expo-secure-store";
import { deletePreviewItem, getPreviewItem, isWebPreview, setPreviewItem } from "./preview-storage";

const TOKEN_KEY = "tomp_driver_token_v2";
const LEGACY_TOKEN_KEYS = ["tomp_driver_token"];

export async function saveDriverToken(token: string) {
  if (await setPreviewItem(TOKEN_KEY, token)) return;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getSavedDriverToken() {
  const preview = await getPreviewItem(TOKEN_KEY);
  if (preview !== null) return preview;
  if (isWebPreview()) return null;
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearLegacyDriverTokens() {
  if (isWebPreview()) {
    await Promise.all(LEGACY_TOKEN_KEYS.map((key) => deletePreviewItem(key)));
    return;
  }
  await Promise.all(LEGACY_TOKEN_KEYS.map((key) => SecureStore.deleteItemAsync(key).catch(() => undefined)));
}

export async function clearDriverToken() {
  if (isWebPreview()) {
    await deletePreviewItem(TOKEN_KEY);
    await clearLegacyDriverTokens();
    return;
  }
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined),
    clearLegacyDriverTokens()
  ]);
}
