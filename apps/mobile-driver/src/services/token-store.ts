import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "tomp_driver_token";

export async function saveDriverToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getSavedDriverToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearDriverToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
