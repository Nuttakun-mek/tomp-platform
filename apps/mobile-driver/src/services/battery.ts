import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const ASKED_KEY = "tomp_driver_battery_prompt_shown";

/**
 * expo-intent-launcher is a native module, so a JS bundle that imports it at the
 * top level crashes on any build that predates it — which is exactly what a
 * dev-client reload does. Resolve it lazily and treat "not there" as "skip".
 */
function loadIntentLauncher(): { startActivityAsync: (action: string, params?: Record<string, unknown>) => Promise<unknown> } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-intent-launcher");
  } catch {
    return null;
  }
}

/**
 * Android puts apps to sleep when the screen is off, and Samsung is stricter
 * than most: even a location foreground service gets throttled once the device
 * sits idle, which stops background GPS. The exemption cannot be granted from
 * code — but this opens the system dialog directly so the driver taps "Allow"
 * once, instead of hunting through Settings.
 *
 * Asked at most once per install: a driver who says no should not be nagged on
 * every trip.
 */
export async function promptBatteryExemptionOnce(): Promise<void> {
  if (Platform.OS !== "android") return;

  const intentLauncher = loadIntentLauncher();
  if (!intentLauncher) return;

  try {
    const asked = await SecureStore.getItemAsync(ASKED_KEY);
    if (asked) return;
    await SecureStore.setItemAsync(ASKED_KEY, new Date().toISOString());

    await intentLauncher.startActivityAsync("android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS", {
      data: "package:com.tomp.driver"
    });
  } catch {
    // The dialog is a convenience. If the OEM does not expose it, background GPS
    // still works — just less reliably — and the driver can set it by hand.
  }
}
