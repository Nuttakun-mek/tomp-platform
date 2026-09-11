import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { decideLocationSend, LOCATION_HEARTBEAT_MS, LOCATION_MOVED_METERS, type LastSentFix } from "@tomp/driver-core";
import { BACKGROUND_GPS_ENABLED, LOCATION_TASK_NAME } from "../config";
import { submitLocation } from "./driver-api";
import { enqueueOfflineAction } from "./offline-queue";
import { getMobileDriverSession, type MobileDriverSession } from "./mobile-session-store";

type LocationCallback = (location: Location.LocationObject) => void;

// The foreground watcher is owned here, not by the caller. It used to be
// returned and dropped on the floor, and stopLocationSharing() only stopped the
// background task — so every "share again" tap added another watchPositionAsync
// that could never be removed. They stacked up until the app died natively.
let foregroundWatch: Location.LocationSubscription | null = null;

// The OS hands us a fix every timeInterval whether the vehicle moved or not.
// Sending every one of those while parked is pure noise, but sending nothing is
// worse: lib/domain/gps-freshness would call the driver offline when they are
// simply waiting at a pickup. So a stationary driver still beats every
// IDLE_HEARTBEAT_MS, flagged so the control room can say "จอดอยู่" instead of
// "ขาดการอัปเดต".
//
// The heartbeat has to stay comfortably under the window the control room uses
// to call a driver offline, or parking produces a stretch of false red every
// single time: the last ping before stopping is a *moving* one, nothing follows
// it until the heartbeat, and the map ages it out in the meantime. Every ping
// therefore carries the cadence it was sent under, so the control room measures
// "overdue" against what this device actually promised rather than a constant
// that has to be kept in sync by hand.
// The send rule — how far is "moved", how often a parked driver still reports,
// and the cadence that rides along on every ping — lives in @tomp/driver-core so
// the web page and this app cannot drift apart. They feed the same map.
let lastSent: LastSentFix | null = null;

// `timeInterval` is Android-only — expo-location documents it as such, and iOS
// ignores it entirely. So the cadence both watchers below ask for (10s / 30s)
// does not exist on iOS: there, delivery is governed only by `distanceInterval`.
//
// That matters because the whole parked-driver design assumes a tick arrives
// regularly and the send rule throttles it down to a heartbeat. Take the ticks
// away and a stationary iOS driver has nothing to throttle — no movement, no
// callback, no heartbeat, and the control room calls them offline for standing
// where they were told to wait.
//
// So the heartbeat gets its own clock instead of borrowing the OS's. The last
// fix is kept, and every tick offers it to the same send rule, which still
// decides whether anything goes out. Harmless on Android, where the callbacks
// already arrive; on iOS it is the only thing keeping a parked driver alive.
const HEARTBEAT_TICK_MS = 30_000;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function resetLocationThrottle() {
  lastSent = null;
}

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    void (async () => {
      // Only when one is actually due. The watcher covers everything else, and
      // asking the GPS for a fix is not free.
      if (!lastSent || Date.now() - lastSent.at < LOCATION_HEARTBEAT_MS) return;

      // Ask where the vehicle is *now*.
      //
      // The first version of this kept the last fix the OS had delivered and
      // re-sent it stamped with the current time. That is a lie the moment the
      // vehicle moves, and it was measured lying: a heartbeat placed the unit at
      // 13.880906,100.539708 and three seconds later the real fix came in at
      // 13.875365,100.536094 — six hundred metres away — while the marker sat
      // still, flagged as parked, on a driver who was driving.
      //
      // A heartbeat that cannot get a fresh position sends nothing. Silence is
      // read as a slow signal and says so on the board; a stale position dressed
      // as a current one says the opposite of the truth.
      const fix = await getCurrentLocation().catch(() => null);
      if (!fix) return;

      await submitOrQueueLocation({
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
        accuracy: fix.coords.accuracy,
        recordedAt: new Date(fix.timestamp).toISOString(),
        trackingEvent: "location_ping",
        metadata: { platform: "mobile_driver", mode: "heartbeat" }
      });
    })();
  }, HEARTBEAT_TICK_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function createLocationClientEventId(recordedAt: string | null | undefined, trackingEvent: string) {
  const compactTime = (recordedAt || new Date().toISOString()).replace(/[^0-9TZ]/g, "");
  const randomPart = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
  return `mobile:${trackingEvent}:${compactTime}:${randomPart}`;
}

export function isForegroundSharing() {
  return foregroundWatch !== null;
}

// Runs in a headless JS context that Android restores after a reboot or a
// process kill. Anything that escapes here takes the whole app down on start,
// so the entire body is guarded — SecureStore and SQLite both live in here.
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  try {
    if (error) return;
    const payload = data as { locations?: Location.LocationObject[] } | undefined;
    const latest = payload?.locations?.[0];
    if (!latest) return;
    const mobileSession = await getMobileDriverSession();
    if (!mobileSession) return;

    await submitOrQueueLocation(
      {
        latitude: latest.coords.latitude,
        longitude: latest.coords.longitude,
        accuracy: latest.coords.accuracy,
        recordedAt: new Date(latest.timestamp).toISOString(),
        trackingEvent: "location_ping",
        metadata: {
          platform: "mobile_driver",
          mode: "background"
        }
      },
      mobileSession
    );
  } catch {
    // A dropped background ping must never crash the app.
  }
});

export async function requestForegroundLocationPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

export async function requestBackgroundLocationPermission() {
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

// Read what the OS actually grants right now. On Android 11+ the background
// request cannot show a dialog — the driver has to pick "Allow all the time" in
// Settings — so the result of requesting is not proof that we may start a
// location foreground service.
export async function hasBackgroundLocationPermission() {
  try {
    const { status } = await Location.getBackgroundPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

// A registered background task is restored on every app start. If it was left
// behind by a crash — or the driver has since revoked the permission — starting
// it again takes the app down before it renders, so clear it out.
export async function stopStaleBackgroundLocationTask() {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (!started) return;
    const [session, allowed] = await Promise.all([getMobileDriverSession(), hasBackgroundLocationPermission()]);
    if (!session || !allowed) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch {
    // never let cleanup break startup
  }
}

const FIRST_FIX_TIMEOUT_MS = 8000;

// getCurrentPositionAsync has no timeout of its own. Indoors it can sit waiting
// for a high-accuracy fix long enough that Android calls the app unresponsive
// and kills it, which is what "tap share, app freezes, app closes" was. Race it,
// fall back to the last known position, and let the caller carry on without a
// first fix — the watcher delivers positions anyway.
export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
  const fix = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), FIRST_FIX_TIMEOUT_MS));
  const raced = await Promise.race([fix, timeout]);
  if (raced) return raced;
  return Location.getLastKnownPositionAsync().catch(() => null);
}

async function submitOrQueueLocation(input: Parameters<typeof submitLocation>[0], mobileSession?: MobileDriverSession | null) {
  const { send, idle } = decideLocationSend(
    lastSent,
    input.latitude,
    input.longitude,
    input.trackingEvent ?? "location_ping",
    Date.now(),
    input.accuracy
  );
  if (!send) return { success: true, skipped: true } as const;

  const payload = {
    ...input,
    metadata: {
      ...(input.metadata ?? {}),
      clientEventId: (input.metadata as Record<string, unknown> | undefined)?.clientEventId ?? createLocationClientEventId(input.recordedAt, input.trackingEvent ?? "location_ping"),
      heartbeatMs: LOCATION_HEARTBEAT_MS,
      ...(idle ? { idle: true } : {})
    }
  };
  // Claim the slot before the network call, not after it.
  //
  // Two watchers run at once — foreground and background — and both reach
  // decideSend before either finishes sending, so both saw the heartbeat as due
  // and both sent it. Every heartbeat wrote two identical rows, which is how a
  // 2-minute cadence showed up in the data as "121s, 0s, 122s, 0s".
  const previous = lastSent;
  lastSent = { latitude: input.latitude, longitude: input.longitude, at: Date.now() };

  const session = mobileSession ?? (await getMobileDriverSession());
  const result = await submitLocation(payload, session).catch((error) => ({
    success: false,
    error: error instanceof Error ? error.message : "ส่งตำแหน่งไม่สำเร็จ"
  }));

  if (!result.success) {
    // Put the claim back: a failed send must not buy silence for a whole
    // heartbeat, or one dropped request reads to the control room as a driver
    // who has gone offline.
    lastSent = previous;
    await enqueueOfflineAction("location", payload);
  }
  return result;
}

export async function startForegroundLocationSharing(onLocation: LocationCallback) {
  // Idempotent: a second request while already watching is a no-op.
  if (foregroundWatch) return foregroundWatch;
  resetLocationThrottle();

  // Never block starting the watcher on a first fix.
  const firstLocation = await getCurrentLocation();
  if (firstLocation) {
    onLocation(firstLocation);
    void submitOrQueueLocation({
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
  }

  foregroundWatch = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      // Android is time-driven: ask for a tick every 10s and let the send rule
      // throttle it. `distanceInterval: 0` is safe there because `timeInterval`
      // bounds how often the callback fires.
      //
      // iOS ignores `timeInterval`, so the same zero means "tell me about every
      // fix the GPS produces" — a continuous stream for the whole shift, which
      // over a five-day operation is a flat battery rather than a busy map. It
      // gets a real distance gate instead, matched to the distance the send rule
      // already treats as movement, and the heartbeat timer covers standing
      // still.
      distanceInterval: Platform.OS === "ios" ? LOCATION_MOVED_METERS : 0,
      timeInterval: 10000
    },
    (location) => {
      onLocation(location);
      void submitOrQueueLocation({
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
  startHeartbeat();
  return foregroundWatch;
}

export async function startBackgroundLocationSharing() {
  if (!BACKGROUND_GPS_ENABLED) return false;

  const mobileSession = await getMobileDriverSession();
  if (!mobileSession) return false;

  // Android throws (natively — a JS catch cannot save the app) when a
  // location-typed foreground service starts without background permission
  // actually granted. Check the live grant, never the request result.
  if (!(await hasBackgroundLocationPermission())) return false;

  try {
    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (alreadyStarted) return true;
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      // High, not Balanced. Balanced resolves from cell towers and wifi, which
      // on a real shift produced fixes accurate to 100 metres — and worse than
      // coarse, they were *identical* fix after fix, because a cell tower does
      // not move. The send rule compares against the last position, read zero
      // metres of movement, and reported a vehicle driving across town as parked
      // at the tower. Then a real GPS fix arrived and the marker jumped 1.2km.
      //
      // Measured 2026-09-11: accuracy swung 10m, 83m, 100m, 48m, 100m, with the
      // 100m readings repeating the same coordinates for twenty minutes. The web
      // page has always asked for high accuracy, which is why this only appeared
      // when drivers moved from the browser to the app.
      accuracy: Location.Accuracy.High,
      // Deliberately 0 on both platforms — the opposite of the foreground
      // watcher, and for a reason that only shows up in the background.
      //
      // On iOS the app is kept alive by the location updates themselves. Put a
      // distance gate here and a parked vehicle produces no updates, so iOS
      // suspends the process, so the JS heartbeat timer stops running — the
      // heartbeat would die exactly when it is the only thing left to send,
      // which is the failure it exists to prevent. A continuous stream is what
      // keeps the runtime awake.
      //
      // The cost is bounded by the send rule rather than by the accuracy: the
      // OS may hand us a fix every thirty seconds, but at most one per heartbeat
      // reaches the server while the vehicle stands still. The OS talking to us
      // often is cheap; us talking to the server often is not.
      distanceInterval: 0,
      timeInterval: 30000,
      // iOS only. Tells CoreLocation this is a vehicle rather than the default
      // "other", which is how it decides when GPS may be powered down, and shows
      // the blue status bar while the app tracks in the background — the driver
      // should be able to see that it is on, and Apple expects it to be visible.
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "TOMP กำลังแชร์ตำแหน่ง",
        notificationBody: "ศูนย์ควบคุมกำลังติดตามตำแหน่งระหว่างปฏิบัติงาน",
        notificationColor: "#007a73"
      }
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopLocationSharing() {
  // The clock goes first: it must not fire a heartbeat for a driver who has
  // just stopped sharing, which would put them back on the map after they left.
  stopHeartbeat();

  // Remove the watcher first so no further pings fire while we are stopping.
  if (foregroundWatch) {
    try {
      foregroundWatch.remove();
    } catch {
      // already gone
    }
    foregroundWatch = null;
  }

  const location = await getCurrentLocation().catch(() => null);
  if (location) {
    await submitOrQueueLocation({
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
  if (started) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => undefined);
}
