import { Platform } from "react-native";

export function isWebPreview() {
  return Platform.OS === "web" && typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export async function getPreviewItem(key: string) {
  if (!isWebPreview()) return null;
  return window.localStorage.getItem(key);
}

export async function setPreviewItem(key: string, value: string) {
  if (!isWebPreview()) return false;
  window.localStorage.setItem(key, value);
  return true;
}

export async function deletePreviewItem(key: string) {
  if (!isWebPreview()) return false;
  window.localStorage.removeItem(key);
  return true;
}
