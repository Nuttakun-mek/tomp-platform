import type { ComponentType, RefAttributes } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  type AppStateStatus,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
// React Native's own SafeAreaView is iOS-only — on Android it renders a plain
// View and honours nothing, which is why this file used to guess the gesture
// bar at a flat 54px. These insets are measured by the OS on both platforms.
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ExpoLinking from "expo-linking";
import { useFonts } from "expo-font";
// Three weights, matching src/theme's `font`. Medium and Black were loaded and
// barely used — Black on nearly every label, which is what made the shell shout
// — and two extra font files is two more things to fetch before first paint.
import {
  NotoSansThai_400Regular,
  NotoSansThai_600SemiBold,
  NotoSansThai_700Bold
} from "@expo-google-fonts/noto-sans-thai";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import Ionicons from "@expo/vector-icons/Ionicons";
import { WebView, type WebViewProps } from "react-native-webview";
import type { WebViewMessageEvent, WebViewNavigation } from "react-native-webview/lib/WebViewTypes";
import { BRIDGE_NAMESPACE, BRIDGE_VERSION, buildNativeStatusMessage, buildViewSwitchMessage, parseBridgeMessage, VIEW_SWITCH_EVENT } from "./src/bridge/protocol";
import { BACKGROUND_GPS_ENABLED, buildDriverWebUrl, EAS_PROJECT_ID, type DriverWebViewKey } from "./src/config";
import { APP_VERSION, APP_VERSION_LABEL } from "./src/services/app-version";
import { font, radius, space, text, TOUCH_MIN, useAppTheme, type ThemeColors, type ThemeOverlay, type ThemePreference } from "./src/theme";
import {
  getLastSharedLocation,
  hasBackgroundLocationPermission,
  isForegroundSharing,
  isLocationSharingActive,
  requestBackgroundLocationPermission,
  requestForegroundLocationPermission,
  startBackgroundLocationSharing,
  startForegroundLocationSharing,
  stopLocationSharing,
  stopStaleBackgroundLocationTask
} from "./src/services/location";
import { promptBatteryExemptionOnce } from "./src/services/battery";
import { exchangeMobileSessionChallenge } from "./src/services/mobile-session-api";
import {
  addNotificationReceivedListener,
  addNotificationTapListener,
  clearDeliveredNotifications,
  registerForPushNotifications,
  syncPushToken
} from "./src/services/push";
import {
  clearLegacyMobileDriverSessions,
  clearMobileDriverSession,
  getInstallationId,
  getMobileDriverSession,
  saveMobileDriverSession
} from "./src/services/mobile-session-store";
import { flushOfflineQueue, getOfflineQueueCount } from "./src/services/offline-queue";
import { clearDriverToken, clearLegacyDriverTokens, getSavedDriverToken, saveDriverToken } from "./src/services/token-store";
import { parseDriverLink } from "./src/services/driver-link";
import { decideWebViewNavigation } from "./src/services/webview-navigation";
import { mt, type MobileLocale } from "./src/i18n";
import { getMobileLocale, saveMobileLocale } from "./src/services/locale-store";
import { getThemePreference, saveThemePreference } from "./src/services/theme-store";

const DriverWebView = WebView as unknown as ComponentType<WebViewProps & RefAttributes<WebView>>;

type ShellMode = "activation" | "web";
type DriverMenuKey = "home" | "next" | "messages" | "location";

const DRIVER_MENU_ITEMS: Array<{ key: DriverMenuKey; label: string; shortLabel: string; view?: DriverWebViewKey }> = [
  { key: "home", label: "หน้าหลัก", shortLabel: "หน้าหลัก", view: "home" },
  { key: "next", label: "แผนงาน", shortLabel: "แผนงาน", view: "next" },
  { key: "messages", label: "ข้อความ", shortLabel: "ข้อความ", view: "messages" },
  { key: "location", label: "ตำแหน่ง", shortLabel: "ตำแหน่ง", view: "gps" }
];

// Runs at document start, before <head> exists. The handle goes first and on its
// own: this script used to begin with document.head.appendChild, which threw at
// that moment, so on every build up to 1.0.0 (9) the handle was never set — the
// page shared GPS from the browser (stopping when the app left the screen) and
// the zoom lock never applied. The viewport now waits for <head>.
const buildBridgeBootstrap = (scheme: "light" | "dark") => `
  (function () {
    // The page follows the app's theme, not only the phone's: its own script
    // reads this attribute (apps/web driver layout, driver-dark.css).
    document.documentElement.setAttribute("data-driver-theme", "${scheme}");
    window.TOMP_MOBILE_SHELL = {
      namespace: "${BRIDGE_NAMESPACE}",
      version: ${BRIDGE_VERSION},
      platform: "${Platform.OS}",
      appVersion: "${APP_VERSION}",
      canBackgroundLocation: ${BACKGROUND_GPS_ENABLED},
      postMessage: function(message) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }
    };
    function pinViewport() {
      if (!document.head) return false;
      var viewport = document.querySelector('meta[name="viewport"]');
      if (!viewport) {
        viewport = document.createElement('meta');
        viewport.setAttribute('name', 'viewport');
        document.head.appendChild(viewport);
      }
      viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
      return true;
    }
    try {
      if (!pinViewport()) document.addEventListener('DOMContentLoaded', pinViewport, { once: true });
    } catch (error) {}
    window.dispatchEvent(new CustomEvent("tomp:mobile-shell-ready", { detail: window.TOMP_MOBILE_SHELL }));
  })();
  true;
`;

function usePulse() {
  const value = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0.4, duration: 700, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  return value;
}

function DriverShell() {
  const insets = useSafeAreaInsets();
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const { colors, overlay, scheme } = useAppTheme(themePreference);
  // Set once per load; a later change is pushed by the effect below instead of
  // reloading the page.
  const bridgeBootstrap = useMemo(() => buildBridgeBootstrap(scheme), [scheme]);
  const styles = useMemo(() => createStyles(colors, overlay), [colors, overlay]);
  const bottomSafeInset = Math.max(insets.bottom, Platform.OS === "android" ? 24 : 0);
  const [fontsLoaded] = useFonts({
    NotoSansThai_400Regular,
    NotoSansThai_600SemiBold,
    NotoSansThai_700Bold
  });
  const pulse = usePulse();
  const webViewRef = useRef<WebView>(null);
  const [mode, setMode] = useState<ShellMode>("activation");
  const [tokenInput, setTokenInput] = useState("");
  const [currentToken, setCurrentToken] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [qrLocked, setQrLocked] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [message, setMessage] = useState("สแกน QR งานที่ได้รับจากศูนย์ควบคุม");
  const [locale, setLocale] = useState<MobileLocale>("th");
  const localeRef = useRef<MobileLocale>("th");
  const [locationSharingActive, setLocationSharingActive] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [webViewError, setWebViewError] = useState<string | null>(null);
  const [outboxCount, setOutboxCount] = useState(0);
  const [syncLabel, setSyncLabel] = useState("");
  const [activeDriverMenu, setActiveDriverMenu] = useState<DriverMenuKey>("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const activeDriverMenuRef = useRef<DriverMenuKey>("home");
  const currentTokenRef = useRef("");

  const currentScreenLabel = mode === "web"
    ? DRIVER_MENU_ITEMS.find((item) => item.key === activeDriverMenu)?.label ?? "ปฏิบัติงาน"
    : "รับงานจากศูนย์ควบคุม";
  // Deliberately independent of the active tab: the URL is the page's one and
  // only load, and which section it shows after that is the shell's to say over
  // the bridge. Baking the tab in here is what made every tab tap a reload.
  const effectiveWebUrl = useMemo(
    () => webUrl || (currentToken ? buildDriverWebUrl(currentToken, locale) : ""),
    [currentToken, locale, webUrl]
  );

  useEffect(() => {
    activeDriverMenuRef.current = activeDriverMenu;
  }, [activeDriverMenu]);

  useEffect(() => {
    currentTokenRef.current = currentToken;
  }, [currentToken]);

  const postStatusToWeb = useCallback((nativeStatus: Parameters<typeof buildNativeStatusMessage>[0], text: string, detail?: Record<string, unknown>) => {
    const payload = buildNativeStatusMessage(nativeStatus, text, detail, { canBackgroundLocation: BACKGROUND_GPS_ENABLED });
    const serialized = JSON.stringify(payload)
      .replace(/</g, "\\u003c")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
    webViewRef.current?.injectJavaScript(`
      window.dispatchEvent(new CustomEvent("tomp:native-status", { detail: ${serialized} }));
      true;
    `);
  }, []);

  useEffect(() => {
    webViewRef.current?.injectJavaScript(`document.documentElement.setAttribute("data-driver-theme", "${scheme}"); true;`);
  }, [scheme]);

  // A tab tap used to change the WebView's source.uri, which is a full HTTP
  // navigation and re-runs the page's server-side assignment fetch for data it
  // already had. The page is loaded once and told which section to show.
  const postViewSwitchToWeb = useCallback((view: DriverWebViewKey) => {
    const message = buildViewSwitchMessage(view);
    const serialized = JSON.stringify(message)
      .replace(/</g, "\\u003c")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
    webViewRef.current?.injectJavaScript(`
      window.dispatchEvent(new CustomEvent("${VIEW_SWITCH_EVENT}", { detail: ${serialized} }));
      true;
    `);
  }, []);

  const postLocationSharingStatus = useCallback(async () => {
    if (await isLocationSharingActive()) {
      const lastLocation = getLastSharedLocation();
      postStatusToWeb(
        "gps_sharing",
        "กำลังส่งตำแหน่ง GPS จากแอปอยู่",
        lastLocation ? { ...lastLocation, source: "native_last_shared_location" } : undefined
      );
    } else {
      postStatusToWeb("gps_stopped", "ยังไม่ได้เริ่มส่งตำแหน่ง GPS");
    }
  }, [postStatusToWeb]);

  const flushOutbox = useCallback(async () => {
    const session = await getMobileDriverSession();
    if (!session) {
      setOutboxCount(await getOfflineQueueCount().catch(() => 0));
      return;
    }

    const result = await flushOfflineQueue().catch(() => null);
    const remaining = result?.remaining ?? (await getOfflineQueueCount().catch(() => 0));
    setOutboxCount(remaining);
    if (result && (result.sent > 0 || result.dropped > 0)) {
      setSyncLabel(`ซิงก์รายการค้างส่งแล้ว ${result.sent} รายการ${result.dropped ? ` และตัดรายการที่ส่งไม่ได้ ${result.dropped} รายการ` : ""}`);
    }
  }, []);

  // Best effort: a driver without notification permission still works, they just
  // do not get alerted while the app is in the background.
  const registerPush = useCallback(async (session: { session: string; expiresAt: string }) => {
    const token = await registerForPushNotifications(EAS_PROJECT_ID);
    if (!token) return;
    await syncPushToken(token, session);
  }, []);

  const openDriverLink = useCallback(
    async (rawValue: string) => {
      const parsed = parseDriverLink(rawValue, localeRef.current);
      if (!parsed) {
        setMessage("ไม่พบ token หรือ URL งาน กรุณาตรวจสอบ QR อีกครั้ง");
        return;
      }

      await saveDriverToken(parsed.token);
      localeRef.current = parsed.locale;
      setLocale(parsed.locale);
      void saveMobileLocale(parsed.locale);
      currentTokenRef.current = parsed.token;
      setCurrentToken(parsed.token);
      setTokenInput(parsed.token);
      setWebUrl(buildDriverWebUrl(parsed.token, parsed.locale, "gps"));
      setScannerOpen(false);
      setQrLocked(false);
      activeDriverMenuRef.current = "location";
      setActiveDriverMenu("location");
      setMode("web");
      setMessage(parsed.source === "raw-token" ? "กำลังเปิดข้อมูลจาก token" : "กำลังเปิดข้อมูลจาก QR");
    },
    []
  );

  const openScanner = useCallback(async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert("ต้องอนุญาตกล้อง", "กรุณาอนุญาตให้ TOMP ใช้กล้องเพื่อสแกน QR งาน");
        return;
      }
    }
    setQrLocked(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScannerOpen((value) => !value);
  }, [cameraPermission?.granted, requestCameraPermission]);

  const handleQrScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (qrLocked) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setQrLocked(true);
      void openDriverLink(result.data);
    },
    [openDriverLink, qrLocked]
  );

  const resetAssignment = useCallback(async () => {
    await stopLocationSharing().catch(() => undefined);
    await clearMobileDriverSession().catch(() => undefined);
    await stopStaleBackgroundLocationTask().catch(() => undefined);
    await clearDeliveredNotifications().catch(() => undefined);
    await clearDriverToken();
    currentTokenRef.current = "";
    activeDriverMenuRef.current = "home";
    setCurrentToken("");
    setWebUrl("");
    setMode("activation");
    setLocationSharingActive(false);
    setHasUnreadMessages(false);
    setOutboxCount(0);
    setSyncLabel("");
    setScannerOpen(false);
    setManualEntryOpen(false);
    setSettingsOpen(false);
    setQrLocked(false);
    setActiveDriverMenu("home");
    setMessage("ออกจากงานนี้แล้ว กรุณาสแกน QR ใหม่เมื่อได้รับงานถัดไป");
  }, []);

  const handleBridgeMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      const parsed = parseBridgeMessage(event.nativeEvent.data);
      if (!parsed) return;

      if (parsed.type === "mobile-session.set") {
        await saveMobileDriverSession(parsed.payload);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        void flushOutbox();
        void registerPush(parsed.payload);
        postStatusToWeb("session_ready", "แอปพร้อมส่งตำแหน่ง GPS เบื้องหลัง");
        return;
      }

      if (parsed.type === "mobile-session.challenge") {
        const installationId = await getInstallationId();
        const result = await exchangeMobileSessionChallenge({
          code: parsed.payload.code,
          installationId
        });
        if (!result.success || !result.data) {
          postStatusToWeb("session_missing", result.error || "ยืนยันสิทธิ์แอปไม่สำเร็จ");
          return;
        }
        await saveMobileDriverSession(result.data);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        void flushOutbox();
        void registerPush(result.data);
        postStatusToWeb("session_ready", "แอปพร้อมส่งตำแหน่ง GPS เบื้องหลัง");
        return;
      }

      if (parsed.type === "open.url") {
        const decision = decideWebViewNavigation(parsed.payload.url);
        if (decision.action === "external") {
          await Linking.openURL(decision.url);
        } else if (decision.action === "block") {
          postStatusToWeb("navigation_blocked", decision.reason, { url: parsed.payload.url });
        }
        return;
      }

      if (parsed.type === "gps.status.request") {
        // Answer from the watcher itself, not from the banner state: the banner
        // is what goes stale, and a wrong answer here is worse than none — it
        // would tell the page sharing is off while the phone keeps reporting.
        await postLocationSharingStatus();
        return;
      }

      if (parsed.type === "driver.notification.unread") {
        setHasUnreadMessages(activeDriverMenuRef.current !== "messages");
        return;
      }

      // The driver tapped "สแกน QR ใหม่" on a job the server no longer knows.
      // No confirm dialog: the page already told them the link is dead.
      if (parsed.type === "job.leave") {
        await resetAssignment();
        setMessage("ลิงก์งานเดิมใช้ไม่ได้แล้ว กรุณาสแกน QR ใหม่จากศูนย์ควบคุม");
        return;
      }

      if (parsed.type === "gps.stop") {
        await stopLocationSharing();
        setLocationSharingActive(false);
        postStatusToWeb("gps_stopped", "หยุดส่งตำแหน่ง GPS จากแอปแล้ว");
        return;
      }

      // Everything below is gps.start, and it says so. It used to be the
      // fall-through, which only stayed correct because parseBridgeMessage
      // happens to reject unknown types — so the day a fifth message is added to
      // the parser, every older build would start GPS for it. Naming the case
      // makes an unknown message do nothing, which is what it should do.
      if (parsed.type !== "gps.start") return;

      const session = await getMobileDriverSession();
      if (!session) {
        setLocationSharingActive(false);
        postStatusToWeb("session_missing", "ยังไม่พร้อมส่งตำแหน่ง GPS เบื้องหลัง กรุณายืนยันงานในหน้าคนขับก่อน");
        return;
      }

      // A repeat gps.start (the web "share again" button) must not stack a
      // second watcher on top of the running one.
      if (isForegroundSharing()) {
        setLocationSharingActive(true);
        postStatusToWeb("gps_sharing", "กำลังส่งตำแหน่ง GPS จากแอปอยู่แล้ว");
        return;
      }

      const foregroundGranted = await requestForegroundLocationPermission();
      if (!foregroundGranted) {
        setLocationSharingActive(false);
        postStatusToWeb("gps_error", "ไม่ได้รับสิทธิ์ตำแหน่งขณะเปิดแอป");
        return;
      }

      setLocationSharingActive(true);
      postStatusToWeb("gps_starting", "กำลังเริ่มส่งตำแหน่ง GPS จากแอป");
      await startForegroundLocationSharing((location) => {
        postStatusToWeb("gps_sharing", "กำลังส่งตำแหน่ง GPS จากแอป", {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          recordedAt: new Date(location.timestamp).toISOString()
        });
      });

      // Foreground sharing is already running and is enough to keep the centre
      // updated while the app is open. Background is a bonus: ask once, then
      // only start the service when the OS actually reports the grant —
      // starting it without one is a native crash, not a rejected promise.
      if (!(await hasBackgroundLocationPermission())) {
        await requestBackgroundLocationPermission();
      }
      const backgroundResult = await startBackgroundLocationSharing();
      // Ask once, and only now: the driver has just chosen to share, so the
      // reason for the exemption is obvious to them.
      if (backgroundResult.started) void promptBatteryExemptionOnce();
      postStatusToWeb(
        "gps_sharing",
        backgroundResult.message,
        { backgroundGps: backgroundResult }
      );
    },
    [flushOutbox, postLocationSharingStatus, postStatusToWeb, resetAssignment]
  );

  const handleNavigation = useCallback(
    (event: WebViewNavigation) => {
      setCanGoBack(event.canGoBack);
      if (event.loading) {
        setWebViewError(null);
        return;
      }
      setMessage("เปิดหน้าคนขับผ่าน TOMP Web แล้ว");

      // The URL carries whichever view it was last built with, and it is no
      // longer rebuilt per tab — so any load the bottom bar did not start (the
      // "ลองใหม่" retry button, a push-notification tap, an OS-initiated
      // reload) would show one section while the bar confidently highlighted
      // another. Whatever the reason for this load, the selected tab is the
      // truth; say so. Read off the ref inside the closure so the delayed call
      // posts the tab the driver is on now, not the one they were on 600ms ago.
      const announceView = () => {
        const view = DRIVER_MENU_ITEMS.find((item) => item.key === activeDriverMenuRef.current)?.view;
        if (view) postViewSwitchToWeb(view);
      };
      announceView();
      setTimeout(announceView, 600);

      // The page loads with no idea what the shell is doing, so it offered
      // "share again" while sharing was already running. Tell it the truth.
      //
      // Twice, because "navigation finished" is not "React has mounted and
      // attached its listener". The GPS tab asks for status itself and recovers
      // from a missed first answer; the job tab only listens, so an answer that
      // lands before its listener exists is gone for good — which is how its GPS
      // dot sat on "ยังไม่ได้ส่ง GPS" for a session the phone was actively
      // reporting. A second truthful status costs nothing; a lost one costs the
      // driver their trust in the light.
      void postLocationSharingStatus();
      setTimeout(() => void postLocationSharingStatus(), 600);
    },
    [postLocationSharingStatus, postViewSwitchToWeb]
  );

  const handleShouldStartLoad = useCallback((request: { url: string }) => {
    const decision = decideWebViewNavigation(request.url);
    if (decision.action === "allow") return true;
    if (decision.action === "external") void Linking.openURL(decision.url);
    if (decision.action === "block") postStatusToWeb("navigation_blocked", decision.reason, { url: request.url });
    return false;
  }, [postStatusToWeb]);

  const openDriverMenu = useCallback((item: { key: DriverMenuKey; view?: DriverWebViewKey }) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettingsOpen(false);
    activeDriverMenuRef.current = item.key;
    setActiveDriverMenu(item.key);
    if (item.key === "messages") {
      setHasUnreadMessages(false);
      void clearDeliveredNotifications();
    }
    if (item.view) postViewSwitchToWeb(item.view);
  }, [postViewSwitchToWeb]);


  const confirmResetAssignment = useCallback(() => {
    Alert.alert(
      "ออกจากงานนี้",
      "ต้องการออกจากงานนี้หรือไม่ ระบบจะหยุดส่งตำแหน่ง GPS และกลับไปหน้ารับงานจากศูนย์ควบคุม",
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ออกจากงาน",
          style: "destructive",
          onPress: () => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            void resetAssignment();
          }
        }
      ]
    );
  }, [resetAssignment]);

  useEffect(() => {
    // A background location task survives a crash and is restored on launch. If
    // it no longer has a session or the permission behind it, clear it before
    // anything else — otherwise it takes the app down on every start and the
    // driver only ever sees a white screen.
    void stopStaleBackgroundLocationTask();
    void clearLegacyDriverTokens();
    void clearLegacyMobileDriverSessions();

    getThemePreference().then(setThemePreference);
    getMobileLocale().then((savedLocale) => {
      localeRef.current = savedLocale;
      setLocale(savedLocale);
      setMessage(mt(savedLocale, "scanInstruction"));
      getSavedDriverToken().then((savedToken) => {
        if (savedToken) void openDriverLink(savedToken);
      });
    });
    // Push registration used to happen only when a session was minted. A driver
    // returning with a session already in SecureStore never got a token, so
    // dispatch could not reach them once the app was backgrounded.
    getMobileDriverSession().then((session) => {
      if (session) void registerPush(session);
    });
    void flushOutbox();
    // Tapping a dispatch notification should land on the job, not just open the
    // shell — the driver is being told to look at something.
    const tapSubscription = addNotificationTapListener(() => {
      setMode("web");
      setActiveDriverMenu("messages");
      setHasUnreadMessages(false);
      const token = currentTokenRef.current;
      if (token) setWebUrl(buildDriverWebUrl(token, localeRef.current, "messages"));
      webViewRef.current?.reload();
      void clearDeliveredNotifications();
    });

    const receivedSubscription = addNotificationReceivedListener(() => {
      if (activeDriverMenuRef.current !== "messages") setHasUnreadMessages(true);
    });

    const subscription = ExpoLinking.addEventListener("url", ({ url }) => {
      void openDriverLink(url);
    });

    ExpoLinking.getInitialURL().then((url) => {
      if (url) void openDriverLink(url);
    });

    // The notification listener was never taken back off, so a remount stacked
    // a second handler and a single tap reloaded the WebView twice.
    return () => {
      subscription.remove();
      tapSubscription.remove();
      receivedSubscription.remove();
    };
  }, [flushOutbox, openDriverLink, registerPush]);

  // When the app went to the background, for the stale-page reload below.
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "background") backgroundedAtRef.current = Date.now();
      if (nextState === "active") {
        // iOS does not always report the WebView's killed process while the
        // app is suspended, and after this long the job, messages and statuses
        // on the page are stale anyway: reload rather than show a blank or old page.
        const away = backgroundedAtRef.current ? Date.now() - backgroundedAtRef.current : 0;
        backgroundedAtRef.current = null;
        if (away > 10 * 60 * 1000) webViewRef.current?.reload();
        void flushOutbox();
        // The driver is looking at the app, so anything still queued in the
        // shade has been seen. Clearing it here is what actually brings the
        // launcher badge back down.
        void clearDeliveredNotifications();
      }
    };

    const appStateSubscription = AppState.addEventListener("change", handleAppState);
    const interval = setInterval(() => {
      void flushOutbox();
    }, 30_000);

    return () => {
      appStateSubscription.remove();
      clearInterval(interval);
    };
  }, [flushOutbox]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (settingsOpen) {
        setSettingsOpen(false);
        return true;
      }
      if (mode === "web" && canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }
      if (mode === "web") {
        confirmResetAssignment();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [canGoBack, confirmResetAssignment, mode, settingsOpen]);

  if (!fontsLoaded && Platform.OS !== "web") {
    return (
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.command} />
        <View style={styles.skeletonTopbar} />
        <View style={styles.skeletonBody}>
          <Animated.View style={[styles.skeletonCard, { opacity: pulse }]} />
          <Animated.View style={[styles.skeletonCard, styles.skeletonCardShort, { opacity: pulse }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.command} />
      <ExpoStatusBar style="light" />
      <View style={styles.shell}>
        {/* The bar owns the status-bar area itself, so its colour runs to the
            top of the screen instead of leaving a pale strip above it. */}
        <View style={[styles.topbar, mode === "web" && styles.topbarCompact, { paddingTop: insets.top + space.xs }]}>
          <View style={styles.topbarCard}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>T</Text>
            </View>
            <View style={styles.identity}>
              <Text numberOfLines={1} style={styles.product}>TOMP Driver</Text>
              <Text numberOfLines={1} style={styles.title}>{currentScreenLabel}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="เปิดการตั้งค่าแอป"
              accessibilityState={{ expanded: settingsOpen }}
              style={({ pressed }) => [styles.topSettingsButton, settingsOpen && styles.topSettingsButtonActive, pressed && styles.pressablePressed]}
              onPress={() => setSettingsOpen((value) => !value)}
            >
              <Ionicons name={settingsOpen ? "settings" : "settings-outline"} size={20} color={settingsOpen ? colors.command : colors.onCommand} />
            </Pressable>
          </View>
        </View>

        {mode === "web" && effectiveWebUrl ? (
          <View style={styles.webContainer}>
            {outboxCount > 0 || syncLabel ? (
              <View style={styles.syncNotice}>
                {outboxCount > 0 ? <Text style={styles.syncNoticeText}>มีข้อมูลรอส่ง {outboxCount} รายการ ระบบจะส่งซ้ำเมื่อสัญญาณพร้อม</Text> : null}
                {syncLabel ? <Text style={styles.syncNoticeText}>{syncLabel}</Text> : null}
              </View>
            ) : null}
            <View style={styles.webFrame}>
              {Platform.OS === "web" ? (
                <View style={styles.webPreviewFrame}>
                  <View style={styles.previewHeroCard}>
                    <View style={styles.previewHeroTopRow}>
                      <View style={styles.previewCallSignGroup}>
                        <Text style={styles.previewKicker}>CALL SIGN</Text>
                        <Text numberOfLines={1} style={styles.previewCallSign}>TEST-Sedan-001</Text>
                        <Text numberOfLines={1} style={styles.previewProject}>Chevron</Text>
                      </View>
                      <View style={styles.previewStatusPill}>
                        <Text style={styles.previewStatusText}>กำลังส่ง GPS</Text>
                      </View>
                    </View>
                    <View style={styles.previewMetaRow}>
                      <View style={styles.previewMetaCell}>
                        <Text style={styles.previewMetaLabel}>คนขับ</Text>
                        <Text numberOfLines={1} style={styles.previewMetaValue}>Driver-test</Text>
                      </View>
                      <View style={styles.previewMetaCell}>
                        <Text style={styles.previewMetaLabel}>รถ</Text>
                        <Text numberOfLines={1} style={styles.previewMetaValue}>1 TS 444 / รถเก๋ง</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.previewTaskCard}>
                    <View style={styles.previewTaskHeader}>
                      <Text style={styles.previewTaskTitle}>
                        {activeDriverMenu === "messages" ? "ข้อความจากศูนย์ควบคุม" : activeDriverMenu === "next" ? "ลำดับงานที่ต้องดำเนินการถัดไป" : activeDriverMenu === "location" ? "การส่งตำแหน่ง" : "รายการปฏิบัติงาน"}
                      </Text>
                      <Text style={styles.previewTaskChip}>{activeDriverMenu === "messages" ? "พร้อมส่ง" : activeDriverMenu === "location" ? "พร้อมแชร์" : "ตัวอย่าง"}</Text>
                    </View>
                    <View style={styles.previewRouteBox}>
                      <Text style={styles.previewRouteLine}>จุดรับ / Mandarin</Text>
                      <Text style={styles.previewRouteLine}>จุดส่ง / Bitec</Text>
                      <Text style={styles.previewRouteMuted}>เวลาที่ต้องถึง ยังไม่ระบุเวลา</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <DriverWebView
                  ref={webViewRef}
                  source={{ uri: effectiveWebUrl }}
                  // What shows when the page is pulled past its top or bottom
                  // (iOS bounce) and while it loads. Unset, it was WebKit's
                  // white, so dark mode flashed a white band on every overscroll.
                  style={styles.webView}
                  injectedJavaScriptBeforeContentLoaded={bridgeBootstrap}
                  onMessage={handleBridgeMessage}
                  onNavigationStateChange={handleNavigation}
                  onShouldStartLoadWithRequest={handleShouldStartLoad}
                  // After a long time in the background (GPS keeps the app itself
                  // alive), the OS kills the WebView's content process to reclaim
                  // memory. The shell survives, the page does not: the driver came
                  // back to the top bar and menu around an empty middle, and tab
                  // taps went to a page that no longer existed. Reload it; the
                  // load handler then re-announces the current tab.
                  onContentProcessDidTerminate={() => webViewRef.current?.reload()}
                  onRenderProcessGone={() => webViewRef.current?.reload()}
                  sharedCookiesEnabled
                  thirdPartyCookiesEnabled
                  javaScriptEnabled
                  domStorageEnabled
                  scalesPageToFit={false}
                  setBuiltInZoomControls={false}
                  setDisplayZoomControls={false}
                  textZoom={100}
                  // Android WebView ships with Geolocation OFF, so navigator.geolocation
                  // was silently dead inside the shell while the app's own GPS kept
                  // reporting normally over the bridge. The driver page uses it directly
                  // when stamping a photo, so every picture waited out the 8s timeout and
                  // then printed "GPS ไม่มีพิกัด" — the one thing the stamp exists to carry.
                  // iOS ignores this prop; the manifest already carries ACCESS_FINE_LOCATION.
                  geolocationEnabled
                  // iOS only — WKWebView's own back/forward swipe gesture. Android's hardware
                  // back button is already handled above via BackHandler; this is the iOS
                  // equivalent affordance, which WebView does not enable by default.
                  allowsBackForwardNavigationGestures
                  startInLoadingState
                  renderLoading={() => (
                    <View style={styles.loading}>
                      <Animated.View style={[styles.skeletonStrip, { opacity: pulse }]} />
                      <Animated.View style={[styles.skeletonCard, { opacity: pulse }]} />
                    </View>
                  )}
                  onError={(syntheticEvent) => {
                    const { description } = syntheticEvent.nativeEvent;
                    setWebViewError(description || "เชื่อมต่อไม่สำเร็จ");
                  }}
                  renderError={() => (
                    <View style={styles.webErrorBox}>
                      <Text style={styles.webErrorGlyph}>⚠️</Text>
                      <Text style={styles.webErrorTitle}>เปิดหน้าคนขับไม่สำเร็จ</Text>
                      <Text style={styles.webErrorText}>ตรวจสอบสัญญาณอินเทอร์เน็ตแล้วลองอีกครั้ง</Text>
                      <Pressable
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.webErrorRetryButton, pressed && styles.pressablePressed]}
                        onPress={() => webViewRef.current?.reload()}
                      >
                        <Text style={styles.webErrorRetryText}>ลองใหม่</Text>
                      </Pressable>
                    </View>
                  )}
                />
              )}
            </View>
            {/* The home-indicator space goes outside the capsule. Inside it, as
                padding, it made the capsule a tall slab with the labels at its top
                edge and its corners running into the screen's own curve. */}
            <View style={[styles.bottomBar, { marginBottom: Math.max(bottomSafeInset, space.sm) }]}>
              {DRIVER_MENU_ITEMS.map((item) => (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeDriverMenu === item.key }}
                  key={item.key}
                  style={({ pressed }) => [
                    styles.menuButton,
                    item.key === "messages" && hasUnreadMessages && activeDriverMenu !== item.key && styles.menuButtonUnread,
                    activeDriverMenu === item.key && styles.menuButtonActive,
                    pressed && styles.pressablePressed
                  ]}
                  onPress={() => openDriverMenu(item)}
                >
                  {item.key === "messages" && hasUnreadMessages ? <View style={styles.menuBadge} /> : null}
                  <Text numberOfLines={1} style={[styles.menuButtonText, activeDriverMenu === item.key && styles.menuButtonTextActive]}>{item.shortLabel}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <ScrollView
            style={styles.activationScroller}
            contentContainerStyle={[styles.activation, { paddingBottom: bottomSafeInset + space.xxl }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.heroCard}>
              <View style={styles.heroMetaRow}>
                <Text style={styles.kicker}>พื้นที่ปฏิบัติงานคนขับ</Text>
              </View>
              <Text style={styles.heroTitle}>รับงานจากศูนย์ควบคุม</Text>
              <Text style={styles.heroCopy}>
                สแกน QR งานที่ได้รับ ตรวจสอบรายละเอียด ยืนยันความพร้อม และเปิดส่งตำแหน่ง GPS ระหว่างปฏิบัติงาน
              </Text>
            </View>

            {scannerOpen ? (
              <View style={styles.scannerBox}>
                <CameraView
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={qrLocked ? undefined : handleQrScanned}
                  style={styles.camera}
                />
                <View style={styles.scannerOverlay}>
                  <Text style={styles.scannerText}>วาง QR ให้อยู่ในกรอบ</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.formCard}>
              <View style={styles.readyCard}>
                <View style={styles.readyDot} />
                <View style={styles.readyCopy}>
                  <Text style={styles.readyTitle}>พร้อมรับงาน</Text>
                  <Text numberOfLines={2} style={styles.readyText}>{message}</Text>
                </View>
              </View>
              <Text style={styles.formTitle}>เริ่มต้นงาน</Text>
              <Text style={styles.formDescription}>ใช้ QR ที่ออกจากศูนย์ควบคุมเท่านั้น หาก QR ไม่พร้อมจึงกรอกลิงก์ด้วยตนเอง</Text>
              <Pressable accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, pressed && styles.pressablePressed]} onPress={openScanner}>
                <Text style={styles.primaryButtonText}>{scannerOpen ? mt(locale, "closeCamera") : mt(locale, "scanQr")}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: manualEntryOpen }}
                style={({ pressed }) => [styles.manualToggle, pressed && styles.pressablePressed]}
                onPress={() => setManualEntryOpen((value) => !value)}
              >
                <Text style={styles.manualToggleText}>{manualEntryOpen ? mt(locale, "hideManualEntry") : mt(locale, "manualEntry")}</Text>
              </Pressable>
              {manualEntryOpen ? (
                <View style={styles.manualEntryBox}>
                  <Text style={styles.orText}>{mt(locale, "pasteUrl")}</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={setTokenInput}
                    placeholder="เช่น https://.../ground-transfer/driver/..."
                    placeholderTextColor={colors.placeholder}
                    style={styles.input}
                    value={tokenInput}
                  />
                  <Pressable accessibilityRole="button" style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressablePressed]} onPress={() => openDriverLink(tokenInput)}>
                    <Text style={styles.secondaryButtonText}>{mt(locale, "openJob")}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>ขั้นตอนที่ควรปฏิบัติ</Text>
              <View style={styles.instructionList}>
                <View style={styles.instructionRow}>
                  <Text style={styles.instructionNumber}>1</Text>
                  <Text style={styles.instructionText}>สแกน QR ที่ได้รับจากศูนย์ควบคุมเพื่อเปิดข้อมูลงาน</Text>
                </View>
                <View style={styles.instructionRow}>
                  <Text style={styles.instructionNumber}>2</Text>
                  <Text style={styles.instructionText}>ตรวจสอบคนขับ รถ จุดรับ จุดส่ง และเวลาปฏิบัติงานให้ถูกต้อง</Text>
                </View>
                <View style={styles.instructionRow}>
                  <Text style={styles.instructionNumber}>3</Text>
                  <Text style={styles.instructionText}>ยืนยันความพร้อมและเปิดสิทธิ์ GPS เมื่อระบบร้องขอ</Text>
                </View>
              </View>
              {outboxCount > 0 ? <Text style={styles.noteText}>รายการที่รอส่งซ้ำ: {outboxCount}</Text> : null}
              {syncLabel ? <Text style={styles.noteText}>{syncLabel}</Text> : null}
            </View>
          </ScrollView>
        )}

        {settingsOpen ? (
          <View style={styles.settingsOverlay}>
            <Pressable
              accessibilityLabel="ปิดการตั้งค่า"
              accessibilityRole="button"
              style={styles.settingsScrim}
              onPress={() => setSettingsOpen(false)}
            />
            <View style={[styles.settingsSheet, { paddingBottom: bottomSafeInset + space.md }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.settingsHeader}>
                <View style={styles.settingsTitleGroup}>
                  <Text style={styles.settingsTitle}>ตั้งค่าแอป</Text>
                  <Text style={styles.settingsSubtitle}>โหมดสี สิทธิ์อุปกรณ์ และการออกจากงานอยู่ในจุดเดียว</Text>
                </View>
                <Text style={styles.settingsVersion}>เวอร์ชัน {APP_VERSION_LABEL}</Text>
              </View>
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>สีของระบบ</Text>
                <View style={styles.themeSegment}>
                  {([
                    ["system", "ตามเครื่อง"],
                    ["light", "สว่าง"],
                    ["dark", "มืด"]
                  ] as const).map(([value, label]) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: themePreference === value }}
                      style={({ pressed }) => [
                        styles.themeSegmentButton,
                        themePreference === value && styles.themeSegmentButtonActive,
                        pressed && styles.pressablePressed
                      ]}
                      onPress={() => {
                        setThemePreference(value);
                        void saveThemePreference(value);
                      }}
                    >
                      <Text style={[styles.themeSegmentText, themePreference === value && styles.themeSegmentTextActive]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.settingsMetaText}>กำลังใช้โหมด{scheme === "dark" ? "มืด" : "สว่าง"}</Text>
              </View>
              <View style={styles.settingsActionRow}>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.settingsSecondaryButton, pressed && styles.pressablePressed]}
                  onPress={() => {
                    if (typeof Linking.openSettings === "function") void Linking.openSettings();
                  }}
                >
                  <Text style={styles.settingsSecondaryButtonText}>สิทธิ์อุปกรณ์</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={mode !== "web"}
                  style={({ pressed }) => [styles.settingsDangerButton, mode !== "web" && styles.settingsDangerButtonDisabled, pressed && styles.pressablePressed]}
                  onPress={confirmResetAssignment}
                >
                  <Text style={[styles.settingsDangerButtonText, mode !== "web" && styles.settingsDangerButtonTextDisabled]}>ออกจากงานนี้</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// The provider has to sit above anything that reads insets, and App is the root,
// so the shell moved one level down rather than the provider being bolted on
// inside it.
export default function App() {
  return (
    <SafeAreaProvider>
      <DriverShell />
    </SafeAreaProvider>
  );
}

function createStyles(colors: ThemeColors, overlay: ThemeOverlay) {
  return StyleSheet.create({
  safe: {
    backgroundColor: colors.command,
    flex: 1
  },
  shell: {
    backgroundColor: colors.canvas,
    flex: 1
  },
  skeletonTopbar: {
    backgroundColor: colors.commandMid,
    height: 68
  },
  skeletonBody: {
    gap: space.md,
    padding: space.lg
  },
  skeletonStrip: {
    backgroundColor: colors.line,
    borderRadius: radius.md,
    height: 40,
    marginBottom: space.md,
    marginHorizontal: space.md,
    marginTop: space.md
  },
  skeletonCard: {
    backgroundColor: colors.line,
    borderRadius: radius.xl,
    height: 140
  },
  skeletonCardShort: {
    height: 88
  },
  pressablePressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }]
  },
  topbar: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    flexDirection: "row",
    minHeight: 72,
    paddingBottom: space.xs,
    paddingHorizontal: space.sm
  },
  topbarCompact: {
    minHeight: 64,
    paddingBottom: space.xs
  },
  topbarCard: {
    alignItems: "center",
    backgroundColor: colors.commandDeep,
    borderColor: overlay.faint,
    borderRadius: radius.xl,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    shadowColor: colors.ink,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.10,
    shadowRadius: 18
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: overlay.soft,
    borderColor: overlay.faint,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  brandMarkText: {
    color: colors.accent,
    fontFamily: font.bold,
    ...text.body
  },
  identity: {
    flex: 1,
    gap: 1,
    minWidth: 0
  },
  product: {
    color: colors.accent,
    fontFamily: font.bold,
    ...text.body
  },
  title: {
    color: colors.onCommandMuted,
    fontFamily: font.semibold,
    ...text.micro
  },
  // A round gear the size of the "T" mark opposite it (brandMark), so the bar
  // is symmetrical; the accessibility label still says what it is.
  topSettingsButton: {
    alignItems: "center",
    backgroundColor: overlay.soft,
    borderColor: overlay.faint,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  topSettingsButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  settingsOverlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 30
  },
  settingsScrim: {
    backgroundColor: "rgba(4,16,26,0.42)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  settingsSheet: {
    backgroundColor: colors.surface,
    borderColor: colors.lineSoft,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    bottom: 0,
    elevation: 18,
    gap: space.md,
    left: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    position: "absolute",
    right: 0,
    shadowColor: colors.ink,
    shadowOffset: { height: -10, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 26
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: colors.lineSoft,
    borderRadius: radius.pill,
    height: 4,
    marginBottom: space.xs,
    width: 44
  },
  settingsHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.md,
    justifyContent: "space-between"
  },
  settingsTitleGroup: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  settingsTitle: {
    color: colors.ink,
    fontFamily: font.bold,
    ...text.body
  },
  settingsSubtitle: {
    color: colors.muted,
    fontFamily: font.regular,
    ...text.micro
  },
  settingsVersion: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.muted,
    fontFamily: font.semibold,
    overflow: "hidden",
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    ...text.micro
  },
  settingsSection: {
    gap: space.sm
  },
  settingsSectionTitle: {
    color: colors.ink,
    fontFamily: font.bold,
    ...text.caption
  },
  themeSegment: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: space.xs,
    padding: space.xs
  },
  themeSegmentButton: {
    alignItems: "center",
    borderRadius: radius.md,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: space.xs
  },
  themeSegmentButtonActive: {
    backgroundColor: colors.operation
  },
  themeSegmentText: {
    color: colors.muted,
    fontFamily: font.semibold,
    textAlign: "center",
    ...text.micro
  },
  themeSegmentTextActive: {
    color: colors.surface,
    fontFamily: font.bold
  },
  settingsMetaText: {
    color: colors.muted,
    fontFamily: font.regular,
    ...text.micro
  },
  settingsActionRow: {
    flexDirection: "row",
    gap: space.sm
  },
  settingsSecondaryButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: TOUCH_MIN,
    paddingHorizontal: space.sm
  },
  settingsSecondaryButtonText: {
    color: colors.ink,
    fontFamily: font.semibold,
    ...text.micro
  },
  settingsDangerButton: {
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningLine,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: TOUCH_MIN,
    paddingHorizontal: space.sm
  },
  settingsDangerButtonDisabled: {
    opacity: 0.45
  },
  settingsDangerButtonText: {
    color: colors.warning,
    fontFamily: font.bold,
    textAlign: "center",
    ...text.micro
  },
  settingsDangerButtonTextDisabled: {
    color: colors.muted
  },
  activationScroller: {
    flex: 1
  },
  activation: {
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md
  },
  heroCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.operationSoft,
    borderRadius: radius.xl,
    borderWidth: 1,
    elevation: 4,
    padding: space.lg,
    shadowColor: colors.ink,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 20
  },
  heroMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
    justifyContent: "space-between"
  },
  kicker: {
    color: colors.operationDeep,
    fontFamily: font.bold,
    ...text.caption
  },
  heroTitle: {
    color: colors.ink,
    fontFamily: font.bold,
    marginTop: space.sm,
    ...text.display
  },
  heroCopy: {
    color: colors.muted,
    fontFamily: font.regular,
    marginTop: space.sm,
    ...text.body
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.xl,
    borderWidth: 1,
    elevation: 4,
    gap: space.sm,
    padding: space.lg,
    shadowColor: colors.ink,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 22
  },
  readyCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.operationSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    elevation: 1,
    flexDirection: "row",
    gap: space.sm,
    padding: space.md,
    shadowColor: colors.operation,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 10
  },
  readyDot: {
    backgroundColor: colors.operation,
    borderColor: colors.operationSoft,
    borderWidth: 4,
    borderRadius: radius.pill,
    height: 18,
    width: 18
  },
  readyCopy: {
    flex: 1,
    minWidth: 0
  },
  readyTitle: {
    color: colors.operationDeep,
    fontFamily: font.bold,
    ...text.caption
  },
  readyText: {
    color: colors.muted,
    fontFamily: font.regular,
    ...text.micro
  },
  formTitle: {
    color: colors.ink,
    fontFamily: font.bold,
    ...text.title
  },
  formDescription: {
    color: colors.muted,
    fontFamily: font.regular,
    ...text.caption
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.operation,
    borderRadius: radius.lg,
    elevation: 3,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: space.lg,
    shadowColor: colors.operation,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 14
  },
  primaryButtonText: {
    color: colors.surface,
    fontFamily: font.bold,
    ...text.strong
  },
  manualToggle: {
    alignItems: "center",
    backgroundColor: colors.operationSoft,
    borderRadius: radius.lg,
    justifyContent: "center",
    minHeight: TOUCH_MIN,
    paddingHorizontal: space.md
  },
  manualToggleText: {
    color: colors.operationDeep,
    fontFamily: font.semibold,
    ...text.body
  },
  manualEntryBox: {
    gap: space.sm
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: space.lg
  },
  secondaryButtonText: {
    color: colors.ink,
    fontFamily: font.semibold,
    ...text.strong
  },
  orText: {
    color: colors.muted,
    fontFamily: font.regular,
    textAlign: "center",
    ...text.body
  },
  input: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.lineSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: font.regular,
    minHeight: 52,
    paddingHorizontal: space.md,
    ...text.strong
  },
  scannerBox: {
    backgroundColor: colors.commandDeep,
    borderRadius: radius.xl,
    height: 320,
    overflow: "hidden",
    position: "relative"
  },
  camera: {
    height: "100%",
    width: "100%"
  },
  scannerOverlay: {
    alignItems: "center",
    borderColor: overlay.frame,
    borderRadius: radius.lg,
    borderWidth: 2,
    bottom: 48,
    justifyContent: "center",
    left: 42,
    position: "absolute",
    right: 42,
    top: 48
  },
  scannerText: {
    backgroundColor: overlay.scannerLabel,
    borderRadius: radius.pill,
    color: colors.surface,
    fontFamily: font.bold,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    ...text.body
  },
  noteCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.operationSoft,
    borderRadius: radius.xl,
    borderWidth: 1,
    elevation: 2,
    gap: space.md,
    padding: space.lg,
    shadowColor: colors.ink,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 16
  },
  noteTitle: {
    color: colors.operationDeep,
    fontFamily: font.bold,
    ...text.body
  },
  instructionList: {
    gap: space.sm
  },
  instructionRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.sm
  },
  instructionNumber: {
    backgroundColor: colors.operationSoft,
    borderRadius: radius.pill,
    color: colors.operationDeep,
    fontFamily: font.bold,
    fontSize: text.caption.fontSize,
    height: 24,
    lineHeight: 24,
    textAlign: "center",
    width: 24
  },
  instructionText: {
    color: colors.muted,
    flex: 1,
    fontFamily: font.regular,
    ...text.body
  },
  noteText: {
    color: colors.muted,
    fontFamily: font.regular,
    ...text.caption
  },
  webContainer: {
    backgroundColor: colors.canvas,
    flex: 1
  },
  syncNotice: {
    backgroundColor: colors.warningSoft,
    borderBottomColor: colors.warningLine,
    borderBottomWidth: 1,
    gap: 2,
    paddingHorizontal: space.md,
    paddingVertical: space.sm
  },
  syncNoticeText: {
    color: colors.warning,
    fontFamily: font.semibold,
    ...text.micro
  },
  webFrame: {
    backgroundColor: colors.canvas,
    flex: 1
  },
  webView: {
    // The page's own background, so the band a bounce exposes is the colour of
    // the page it stretches.
    backgroundColor: colors.webPage,
    flex: 1
  },
  webPreviewFrame: {
    backgroundColor: colors.canvas,
    flex: 1,
    gap: space.md,
    padding: space.md
  },
  previewHeroCard: {
    backgroundColor: colors.command,
    borderColor: overlay.soft,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: space.lg,
    overflow: "hidden",
    padding: space.lg,
    shadowColor: colors.ink,
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 24
  },
  previewHeroTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: space.sm,
    justifyContent: "space-between"
  },
  previewCallSignGroup: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  previewKicker: {
    color: colors.accent,
    fontFamily: font.bold,
    letterSpacing: 0,
    ...text.micro
  },
  previewCallSign: {
    // On the command-coloured card, which is dark in both themes; surface is
    // white only in the light palette, so this vanished in dark mode.
    color: colors.onCommand,
    fontFamily: font.bold,
    ...text.display
  },
  previewProject: {
    color: colors.onCommand,
    fontFamily: font.semibold,
    ...text.body
  },
  previewStatusPill: {
    backgroundColor: overlay.successFill,
    borderColor: colors.successOnDark,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs
  },
  previewStatusText: {
    color: colors.successOnDark,
    fontFamily: font.bold,
    ...text.micro
  },
  previewMetaRow: {
    flexDirection: "row",
    gap: space.sm
  },
  previewMetaCell: {
    backgroundColor: overlay.soft,
    borderRadius: radius.lg,
    flex: 1,
    gap: 1,
    minWidth: 0,
    paddingHorizontal: space.md,
    paddingVertical: space.sm
  },
  previewMetaLabel: {
    color: colors.onCommandMuted,
    fontFamily: font.semibold,
    ...text.micro
  },
  previewMetaValue: {
    // On the command-coloured card, which is dark in both themes; surface is
    // white only in the light palette, so this vanished in dark mode.
    color: colors.onCommand,
    fontFamily: font.bold,
    ...text.caption
  },
  previewTaskCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: space.md,
    padding: space.lg,
    shadowColor: colors.ink,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 20
  },
  previewTaskHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: space.sm,
    justifyContent: "space-between"
  },
  previewTaskTitle: {
    color: colors.ink,
    fontFamily: font.bold,
    flex: 1,
    ...text.strong
  },
  previewTaskChip: {
    backgroundColor: colors.operationSoft,
    borderRadius: radius.pill,
    color: colors.operationDeep,
    fontFamily: font.bold,
    overflow: "hidden",
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    ...text.micro
  },
  previewRouteBox: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    gap: space.xs,
    padding: space.md
  },
  previewRouteLine: {
    color: colors.ink,
    fontFamily: font.semibold,
    ...text.body
  },
  previewRouteMuted: {
    color: colors.muted,
    fontFamily: font.regular,
    ...text.caption
  },
  loading: {
    alignItems: "center",
    backgroundColor: colors.surface,
    bottom: 0,
    gap: space.sm,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  webErrorBox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    bottom: 0,
    gap: space.sm,
    justifyContent: "center",
    left: 0,
    paddingHorizontal: space.xl,
    position: "absolute",
    right: 0,
    top: 0
  },
  webErrorGlyph: {
    fontSize: text.display.fontSize
  },
  webErrorTitle: {
    color: colors.ink,
    fontFamily: font.bold,
    ...text.title
  },
  webErrorText: {
    color: colors.muted,
    fontFamily: font.regular,
    textAlign: "center",
    ...text.body
  },
  webErrorRetryButton: {
    alignItems: "center",
    backgroundColor: colors.operation,
    borderRadius: radius.lg,
    justifyContent: "center",
    minHeight: TOUCH_MIN,
    marginTop: space.sm,
    paddingHorizontal: space.xl
  },
  webErrorRetryText: {
    color: colors.surface,
    fontFamily: font.bold,
    ...text.strong
  },
  // The same capsule as the top bar (topbarCard + topSettingsButton), so the
  // two ends of the screen read as one set of controls.
  bottomBar: {
    alignItems: "center",
    backgroundColor: colors.commandDeep,
    borderColor: overlay.faint,
    borderRadius: radius.pill,
    borderWidth: 1,
    elevation: 10,
    flexDirection: "row",
    gap: space.xs,
    marginBottom: space.sm,
    marginHorizontal: space.sm,
    marginTop: space.sm,
    padding: 6,
    shadowColor: colors.ink,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.10,
    shadowRadius: 18
  },
  menuButton: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: space.xs,
    paddingVertical: space.xs,
    position: "relative"
  },
  menuButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent
  },
  menuButtonUnread: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerLine,
    borderWidth: 1
  },
  menuButtonText: {
    color: colors.onCommandMuted,
    fontFamily: font.semibold,
    textAlign: "center",
    ...text.caption
  },
  menuButtonTextActive: {
    color: colors.command,
    fontFamily: font.bold
  },
  menuBadge: {
    backgroundColor: colors.danger,
    borderColor: colors.commandDeep,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 12,
    position: "absolute",
    right: 10,
    top: 7,
    width: 12,
    zIndex: 2
  }
  });
}
