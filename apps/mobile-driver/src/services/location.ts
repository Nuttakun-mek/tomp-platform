import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { LOCATION_TASK_NAME } from "../config";
import { submitLocation } from "./driver-api";
import { enqueueOfflineAction } from "./offline-queue";
import { getSavedDriverToken } from "./token-store";

type LocationCallback = (location: Location.LocationObject) => void;

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  const payload = data as { locations?: Location.LocationObject[] } | undefined;
  const latest = payload?.locations?.[0];
  if (!latest) return;
  const token = await getSavedDriverToken();
  if (!token) return;
  await submitLocation({
    token,
    latitude: latest.coords.latitude,
    longitude: latest.coords.longitude,
    accuracy: latest.coords.accuracy,
    recordedAt: new Date(latest.timestamp).toISOString(),
    trackingEvent: "location_ping",
    metadata: {
      platform: "mobile_driver",
      mode: "background"
    }
  }).catch(() => undefined);
});

export async function requestForegroundLocationPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

export async function requestBackgroundLocationPermission() {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === "granted";
}

export async function getCurrentLocation() {
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
}

async function submitOrQueueLocation(input: Parameters<typeof submitLocation>[0]) {
  const result = await submitLocation(input).catch((error) => ({
    success: false,
    error: error instanceof Error ? error.message : "ส่งตำแหน่งไม่สำเร็จ"
  }));
  if (!result.success) {
    await enqueueOfflineAction("location", input);
  }
  return result;
}

export async function startForegroundLocationSharing(token: string, onLocation: LocationCallback) {
  const firstLocation = await getCurrentLocation();
  onLocation(firstLocation);
  await submitOrQueueLocation({
    token,
    latitude: firstLocation.coords.latitude,
    longitude: firstLocation.coords.longitude,
    accuracy: firstLocation.coords.accuracy,
    recordedAt: new Date(firstLocation.timestamp).toISOString(),
    trackingEvent: "sharing_started",
    metadata: {
      platform: "mobile_driver",
      mode: "foreground"
    }
  });

  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 15,
      timeInterval: 10000
    },
    (location) => {
      onLocation(location);
      void submitOrQueueLocation({
        token,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        recordedAt: new Date(location.timestamp).toISOString(),
        trackingEvent: "location_ping",
        metadata: {
          platform: "mobile_driver",
          mode: "foreground"
        }
      });
    }
  );
}

export async function startBackgroundLocationSharing() {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
  if (alreadyStarted) return true;
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 25,
    timeInterval: 30000,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: "TOMP กำลังแชร์ตำแหน่ง",
      notificationBody: "ศูนย์ควบคุมกำลังติดตามตำแหน่งระหว่างปฏิบัติงาน",
      notificationColor: "#007a73"
    }
  });
  return true;
}

export async function stopLocationSharing(token: string) {
  const location = await getCurrentLocation().catch(() => null);
  if (location) {
    await submitOrQueueLocation({
      token,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      recordedAt: new Date(location.timestamp).toISOString(),
      trackingEvent: "sharing_stopped",
      metadata: {
        platform: "mobile_driver"
      }
    }).catch(() => undefined);
  }
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
  if (started) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}
