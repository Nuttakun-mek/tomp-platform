import * as SecureStore from "expo-secure-store";
import { DEFAULT_MOBILE_LOCALE, normalizeMobileLocale, type MobileLocale } from "../i18n";

const LOCALE_KEY = "tomp_driver_locale";

export async function saveMobileLocale(locale: MobileLocale) {
  await SecureStore.setItemAsync(LOCALE_KEY, normalizeMobileLocale(locale));
}

export async function getMobileLocale(): Promise<MobileLocale> {
  const value = await SecureStore.getItemAsync(LOCALE_KEY);
  return normalizeMobileLocale(value ?? DEFAULT_MOBILE_LOCALE);
}
