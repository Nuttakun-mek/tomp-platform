import * as SecureStore from "expo-secure-store";
import type { ThemePreference } from "../theme";
import { getPreviewItem, isWebPreview, setPreviewItem } from "./preview-storage";

const THEME_KEY = "tomp_driver_theme_preference";
const THEME_VALUES: readonly ThemePreference[] = ["system", "light", "dark"];

export function normalizeThemePreference(value: string | null | undefined): ThemePreference {
  return THEME_VALUES.includes(value as ThemePreference) ? (value as ThemePreference) : "system";
}

export async function saveThemePreference(preference: ThemePreference) {
  if (await setPreviewItem(THEME_KEY, normalizeThemePreference(preference))) return;
  await SecureStore.setItemAsync(THEME_KEY, normalizeThemePreference(preference));
}

export async function getThemePreference() {
  const preview = await getPreviewItem(THEME_KEY);
  if (preview !== null) return normalizeThemePreference(preview);
  if (isWebPreview()) return "system";
  return normalizeThemePreference(await SecureStore.getItemAsync(THEME_KEY));
}
