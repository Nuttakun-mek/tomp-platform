import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { TOMP_API_BASE_URL } from "../config";
import type { MobileDriverSession } from "./mobile-session-store";

const ANDROID_CHANNEL_ID = "driver-alerts";
const REQUEST_TIMEOUT_MS = 10_000;

// Show alerts even while the driver has the app open — a dispatch message is
// exactly the thing they must not miss.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "แจ้งเตือนงานคนขับ",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#007a73",
    sound: "default"
  });
}

/**
 * Ask for permission and return this device's Expo push token, or null when the
 * driver declines, the build has no EAS project id, or this is an emulator.
 * Never throws — a missing push token must not stop the driver working.
 */
export async function registerForPushNotifications(projectId?: string): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) return null;

    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return token?.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Hand the token to the server so dispatch can reach this driver while the app
 * is backgrounded. Scoped by the mobile session, so the server knows which
 * assignment it belongs to without trusting anything the client claims.
 */
export async function syncPushToken(token: string, mobileSession: MobileDriverSession): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${TOMP_API_BASE_URL}/api/driver/push-token`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-driver-session": mobileSession.session },
      body: JSON.stringify({ token, platform: Platform.OS })
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run `onTap` when the driver taps one of our notifications. Returns a handle
 * the caller removes on unmount.
 */
export function addNotificationTapListener(onTap: (data: Record<string, unknown>) => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
    onTap(data);
  });
}
