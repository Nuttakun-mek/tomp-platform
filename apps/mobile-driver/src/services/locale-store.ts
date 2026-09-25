import * as SecureStore from "expo-secure-store";
import { DEFAULT_MOBILE_LOCALE, normalizeMobileLocale, type MobileLocale } from "../i18n";
import { getPreviewItem, isWebPreview, setPreviewItem } from "./preview-storage";

const LOCALE_KEY = "tomp_driver_locale";

export async function saveMobileLocale(locale: MobileLocale) {
  if (await setPreviewItem(LOCALE_KEY, normalizeMobileLocale(locale))) return;
  await SecureStore.setItemAsync(LOCALE_KEY, normalizeMobileLocale(locale));
}

export async function getMobileLocale(): Promise<MobileLocale> {
  const preview = await getPreviewItem(LOCALE_KEY);
  if (preview !== null) return normalizeMobileLocale(preview);
  if (isWebPreview()) return DEFAULT_MOBILE_LOCALE;
  const value = await SecureStore.getItemAsync(LOCALE_KEY);
  return normalizeMobileLocale(value ?? DEFAULT_MOBILE_LOCALE);
}
