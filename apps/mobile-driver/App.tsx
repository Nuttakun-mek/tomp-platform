import type { ComponentType, RefAttributes } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import * as ExpoLinking from "expo-linking";
import * as Network from "expo-network";
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
import { WebView, type WebViewProps } from "react-native-webview";
import type { WebViewMessageEvent, WebViewNavigation } from "react-native-webview/lib/WebViewTypes";
import { BRIDGE_NAMESPACE, BRIDGE_VERSION, buildNativeStatusMessage, parseBridgeMessage } from "./src/bridge/protocol";
import { BACKGROUND_GPS_ENABLED, buildDriverWebUrl, EAS_PROJECT_ID, TOMP_DRIVER_APP_VERSION, type DriverWebViewKey } from "./src/config";
import { colors, font, overlay, radius, space, text, TOUCH_MIN } from "./src/theme";
import {
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

const DriverWebView = WebView as unknown as ComponentType<WebViewProps & RefAttributes<WebView>>;

type ShellMode = "activation" | "web";
type DriverMenuKey = "home" | "next" | "messages" | "location";

const DRIVER_MENU_ITEMS: Array<{ key: DriverMenuKey; label: string; view?: DriverWebViewKey }> = [
  { key: "home", label: "ปฏิบัติงาน", view: "home" },
  { key: "next", label: "ลำดับงาน", view: "next" },
  { key: "messages", label: "ข้อความ", view: "messages" },
  { key: "location", label: "ตำแหน่ง", view: "gps" }
];

const bridgeBootstrap = `
  (function () {
    window.TOMP_MOBILE_SHELL = {
      namespace: "${BRIDGE_NAMESPACE}",
      version: ${BRIDGE_VERSION},
      platform: "${Platform.OS}",
      appVersion: "${TOMP_DRIVER_APP_VERSION}",
      canBackgroundLocation: ${BACKGROUND_GPS_ENABLED},
      postMessage: function(message) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }
    };
    window.dispatchEvent(new CustomEvent("tomp:mobile-shell-ready", { detail: window.TOMP_MOBILE_SHELL }));
  })();
  true;
`;

function DriverShell() {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    NotoSansThai_400Regular,
    NotoSansThai_600SemiBold,
    NotoSansThai_700Bold
  });
  const webViewRef = useRef<WebView>(null);
  const [mode, setMode] = useState<ShellMode>("activation");
  const [tokenInput, setTokenInput] = useState("");
  const [currentToken, setCurrentToken] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [qrLocked, setQrLocked] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [message, setMessage] = useState("สแกน QR หรือวาง URL งานที่ได้รับจากศูนย์ควบคุม");
  const [locale, setLocale] = useState<MobileLocale>("th");
  const localeRef = useRef<MobileLocale>("th");
  const [sessionReady, setSessionReady] = useState(false);
  const [networkLabel, setNetworkLabel] = useState("กำลังตรวจสอบสัญญาณ");
  const [networkConnected, setNetworkConnected] = useState<boolean | null>(null);
  const [locationSharingActive, setLocationSharingActive] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [outboxCount, setOutboxCount] = useState(0);
  const [syncLabel, setSyncLabel] = useState("");
  const [activeDriverMenu, setActiveDriverMenu] = useState<DriverMenuKey>("home");
  const activeDriverMenuRef = useRef<DriverMenuKey>("home");
  const currentTokenRef = useRef("");

  const activeWebView = useMemo(
    () => DRIVER_MENU_ITEMS.find((item) => item.key === activeDriverMenu)?.view ?? "home",
    [activeDriverMenu]
  );
  const networkTone = locationSharingActive ? "live" : networkConnected === false ? "offline" : "idle";
  const networkDisplayLabel =
    // "ยังไม่ได้ส่ง GPS" read as a fault to drivers, when it is simply the
    // normal state before a shift starts. Say what is true and what is next.
    networkConnected === false
      ? "ออฟไลน์ · ข้อมูลจะส่งเมื่อสัญญาณกลับมา"
      : locationSharingActive
        ? "กำลังส่งตำแหน่งให้ศูนย์ควบคุม"
        : "พร้อมใช้งาน · ยังไม่เริ่มส่งตำแหน่ง";
  const currentScreenLabel = mode === "web"
    ? DRIVER_MENU_ITEMS.find((item) => item.key === activeDriverMenu)?.label ?? "ปฏิบัติงาน"
    : `เวอร์ชัน ${TOMP_DRIVER_APP_VERSION}`;
  const effectiveWebUrl = useMemo(
    () => webUrl || (currentToken ? buildDriverWebUrl(currentToken, locale, activeWebView) : ""),
    [activeWebView, currentToken, locale, webUrl]
  );

  useEffect(() => {
    activeDriverMenuRef.current = activeDriverMenu;
  }, [activeDriverMenu]);

  useEffect(() => {
    currentTokenRef.current = currentToken;
  }, [currentToken]);

  const changeLocale = useCallback((nextLocale: MobileLocale) => {
    localeRef.current = nextLocale;
    setLocale(nextLocale);
    void saveMobileLocale(nextLocale);
    if (currentToken) setWebUrl(buildDriverWebUrl(currentToken, nextLocale, activeWebView));
  }, [activeWebView, currentToken]);

  const postStatusToWeb = useCallback((nativeStatus: Parameters<typeof buildNativeStatusMessage>[0], text: string, detail?: Record<string, unknown>) => {
    const payload = buildNativeStatusMessage(nativeStatus, text, detail);
    const serialized = JSON.stringify(payload)
      .replace(/</g, "\\u003c")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
    webViewRef.current?.injectJavaScript(`
      window.dispatchEvent(new CustomEvent("tomp:native-status", { detail: ${serialized} }));
      true;
    `);
  }, []);

  const postLocationSharingStatus = useCallback(async () => {
    if (await isLocationSharingActive()) {
      postStatusToWeb("gps_sharing", "กำลังส่งตำแหน่ง GPS จากแอปอยู่");
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
      setWebUrl(buildDriverWebUrl(parsed.token, parsed.locale, "home"));
      setScannerOpen(false);
      setQrLocked(false);
      activeDriverMenuRef.current = "home";
      setActiveDriverMenu("home");
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
    setScannerOpen((value) => !value);
  }, [cameraPermission?.granted, requestCameraPermission]);

  const handleQrScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (qrLocked) return;
      setQrLocked(true);
      void openDriverLink(result.data);
    },
    [openDriverLink, qrLocked]
  );

  const handleBridgeMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      const parsed = parseBridgeMessage(event.nativeEvent.data);
      if (!parsed) return;

      if (parsed.type === "mobile-session.set") {
        await saveMobileDriverSession(parsed.payload);
        setSessionReady(true);
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
          setSessionReady(false);
          postStatusToWeb("session_missing", result.error || "ยืนยันสิทธิ์แอปไม่สำเร็จ");
          return;
        }
        await saveMobileDriverSession(result.data);
        setSessionReady(true);
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
        setSessionReady(false);
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
    [flushOutbox, postLocationSharingStatus, postStatusToWeb]
  );

  const handleNavigation = useCallback(
    (event: WebViewNavigation) => {
      setCanGoBack(event.canGoBack);
      if (event.loading) {
        return;
      }
      setMessage("เปิดหน้าคนขับผ่าน TOMP Web แล้ว");

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
    [postLocationSharingStatus]
  );

  const handleShouldStartLoad = useCallback((request: { url: string }) => {
    const decision = decideWebViewNavigation(request.url);
    if (decision.action === "allow") return true;
    if (decision.action === "external") void Linking.openURL(decision.url);
    if (decision.action === "block") postStatusToWeb("navigation_blocked", decision.reason, { url: request.url });
    return false;
  }, [postStatusToWeb]);

  const openDriverMenu = useCallback((item: { key: DriverMenuKey; view?: DriverWebViewKey }) => {
    activeDriverMenuRef.current = item.key;
    setActiveDriverMenu(item.key);
    if (item.key === "messages") {
      setHasUnreadMessages(false);
      void clearDeliveredNotifications();
    }
    if (currentToken && item.view) setWebUrl(buildDriverWebUrl(currentToken, localeRef.current, item.view));
  }, [currentToken]);

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
    setSessionReady(false);
    setLocationSharingActive(false);
    setHasUnreadMessages(false);
    setOutboxCount(0);
    setSyncLabel("");
    setScannerOpen(false);
    setManualEntryOpen(false);
    setQrLocked(false);
    setActiveDriverMenu("home");
    setMessage("ออกจากงานแล้ว กรุณาสแกน QR ใหม่เมื่อได้รับงานถัดไป");
  }, []);

  const confirmResetAssignment = useCallback(() => {
    Alert.alert(
      "ออกจากงานนี้",
      "ต้องการออกจากงานนี้หรือไม่ ระบบจะหยุดส่งตำแหน่ง GPS และกลับไปหน้ารับงานจากศูนย์ควบคุม",
      [
        { text: "ยกเลิก", style: "cancel" },
        { text: "ออกจากงาน", style: "destructive", onPress: () => void resetAssignment() }
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
      setSessionReady(Boolean(session));
      if (session) void registerPush(session);
    });
    void flushOutbox();
    Network.getNetworkStateAsync().then((state) => {
      setNetworkConnected(Boolean(state.isConnected));
      setNetworkLabel(state.isConnected ? "ออนไลน์" : "ออฟไลน์");
    });

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

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        void flushOutbox();
        // The driver is looking at the app, so anything still queued in the
        // shade has been seen. Clearing it here is what actually brings the
        // launcher badge back down.
        void clearDeliveredNotifications();
        Network.getNetworkStateAsync().then((state) => {
          setNetworkConnected(Boolean(state.isConnected));
          setNetworkLabel(state.isConnected ? "ออนไลน์" : "ออฟไลน์");
        });
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
  }, [canGoBack, confirmResetAssignment, mode]);

  if (!fontsLoaded) {
    return (
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.command} />
        <View style={styles.fontLoading}>
          <ActivityIndicator color={colors.accent} />
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
        <View style={[styles.topbar, { paddingTop: insets.top + space.md }]}>
          <View style={styles.identity}>
            <Text style={styles.product}>TOMP Driver</Text>
            <Text style={styles.title}>{currentScreenLabel}</Text>
          </View>
          <View style={styles.statusGroup}>
            <View style={styles.localeSwitch}>
              {(["th", "en"] as const).map((item) => (
                <Pressable key={item} onPress={() => changeLocale(item)} style={[styles.localeButton, locale === item && styles.localeButtonActive]}>
                  <Text style={[styles.localeButtonText, locale === item && styles.localeButtonTextActive]}>{item.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
            <Text
              style={[
                styles.network,
                networkTone === "live" ? styles.networkLive : networkTone === "offline" ? styles.networkOffline : styles.networkIdle
              ]}
            >
              {networkDisplayLabel || networkLabel}
            </Text>
          </View>
        </View>

        {mode === "web" && effectiveWebUrl ? (
          <View style={styles.webContainer}>
            <View style={styles.operationStrip}>
              <View style={styles.operationStatusItem}>
                <View style={[styles.statusDot, sessionReady ? styles.statusDotOk : styles.statusDotPending]} />
                <View style={styles.operationStatusCopy}>
                  <Text style={styles.operationStatusTitle}>{sessionReady ? "พร้อมส่งข้อมูลให้ศูนย์ควบคุม" : "รอการยืนยันงาน"}</Text>
                </View>
              </View>
              <Text style={styles.webVersionText}>เวอร์ชัน {TOMP_DRIVER_APP_VERSION}</Text>
            </View>
            {outboxCount > 0 || syncLabel ? (
              <View style={styles.syncNotice}>
                {outboxCount > 0 ? <Text style={styles.syncNoticeText}>มีข้อมูลรอส่ง {outboxCount} รายการ ระบบจะส่งซ้ำเมื่อสัญญาณพร้อม</Text> : null}
                {syncLabel ? <Text style={styles.syncNoticeText}>{syncLabel}</Text> : null}
              </View>
            ) : null}
            {activeDriverMenu === "location" ? (
              // Two account-level actions used to be squeezed into a 112px
              // column beside the GPS copy, where a mis-tap costs a driver
              // their session. They get a full-width row of their own.
              <View style={styles.locationAssist}>
                <View style={styles.locationAssistCopy}>
                  <Text style={styles.locationAssistTitle}>การส่งตำแหน่ง GPS</Text>
                  <Text style={styles.locationAssistText}>
                    หากศูนย์ควบคุมมองไม่เห็นตำแหน่งของคุณ ให้ตรวจสิทธิ์ตำแหน่งในการตั้งค่าอุปกรณ์
                  </Text>
                </View>
                <View style={styles.locationActionGroup}>
                  <Pressable
                    accessibilityLabel="เปิดหน้าตั้งค่าอุปกรณ์"
                    style={styles.locationSettingsButton}
                    onPress={() => Linking.openSettings()}
                  >
                    <Text style={styles.locationSettingsButtonText}>ตั้งค่าอุปกรณ์</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="ออกจากงานนี้และกลับไปสแกน QR ใหม่"
                    style={styles.locationResetButton}
                    onPress={confirmResetAssignment}
                  >
                    <Text style={styles.locationResetButtonText}>ออกจากงานนี้</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            <View style={styles.webFrame}>
              <DriverWebView
                ref={webViewRef}
                source={{ uri: effectiveWebUrl }}
                injectedJavaScriptBeforeContentLoaded={bridgeBootstrap}
                onMessage={handleBridgeMessage}
                onNavigationStateChange={handleNavigation}
                onShouldStartLoadWithRequest={handleShouldStartLoad}
                sharedCookiesEnabled
                thirdPartyCookiesEnabled
                javaScriptEnabled
                domStorageEnabled
                // Android WebView ships with Geolocation OFF, so navigator.geolocation
                // was silently dead inside the shell while the app's own GPS kept
                // reporting normally over the bridge. The driver page uses it directly
                // when stamping a photo, so every picture waited out the 8s timeout and
                // then printed "GPS ไม่มีพิกัด" — the one thing the stamp exists to carry.
                // iOS ignores this prop; the manifest already carries ACCESS_FINE_LOCATION.
                geolocationEnabled
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.loading}>
                    <ActivityIndicator color={colors.operation} />
                    <Text style={styles.loadingText}>กำลังเปิดหน้าคนขับ</Text>
                  </View>
                )}
              />
            </View>
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + space.md }]}>
              {DRIVER_MENU_ITEMS.map((item) => (
                <Pressable
                  key={item.key}
                  style={[
                    styles.menuButton,
                    item.key === "messages" && hasUnreadMessages && activeDriverMenu !== item.key && styles.menuButtonUnread,
                    activeDriverMenu === item.key && styles.menuButtonActive
                  ]}
                  onPress={() => openDriverMenu(item)}
                >
                  {item.key === "messages" && hasUnreadMessages ? <View style={styles.menuBadge} /> : null}
                  <Text style={[styles.menuButtonText, activeDriverMenu === item.key && styles.menuButtonTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <ScrollView
            style={styles.activationScroller}
            contentContainerStyle={[styles.activation, { paddingBottom: insets.bottom + space.xxl }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.heroCard}>
              <Text style={styles.kicker}>พื้นที่ปฏิบัติงานคนขับ</Text>
              <Text style={styles.heroTitle}>สแกน QR เพื่อรับงาน</Text>
              <Text style={styles.heroCopy}>
                ใช้ QR ที่ได้รับจากศูนย์ควบคุมเพื่อเปิดรายละเอียดงาน ยืนยันความพร้อม และส่งตำแหน่ง GPS ระหว่างปฏิบัติงาน
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
              <Pressable style={styles.primaryButton} onPress={openScanner}>
                <Text style={styles.primaryButtonText}>{scannerOpen ? mt(locale, "closeCamera") : mt(locale, "scanQr")}</Text>
              </Pressable>
              <Pressable style={styles.manualToggle} onPress={() => setManualEntryOpen((value) => !value)}>
                <Text style={styles.manualToggleText}>{manualEntryOpen ? mt(locale, "hideManualEntry") : mt(locale, "manualEntry")}</Text>
              </Pressable>
              {manualEntryOpen ? (
                <View style={styles.manualEntryBox}>
                  <Text style={styles.orText}>{mt(locale, "pasteUrl")}</Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={setTokenInput}
                    placeholder="เช่น https://.../driver/..."
                    placeholderTextColor={colors.placeholder}
                    style={styles.input}
                    value={tokenInput}
                  />
                  <Pressable style={styles.secondaryButton} onPress={() => openDriverLink(tokenInput)}>
                    <Text style={styles.secondaryButtonText}>{mt(locale, "openJob")}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>แนวทางการใช้งาน</Text>
              <View style={styles.instructionList}>
                <View style={styles.instructionRow}>
                  <Text style={styles.instructionNumber}>1</Text>
                  <Text style={styles.instructionText}>สแกน QR ที่ได้รับจากศูนย์ควบคุมเพื่อเปิดงานของคุณ</Text>
                </View>
                <View style={styles.instructionRow}>
                  <Text style={styles.instructionNumber}>2</Text>
                  <Text style={styles.instructionText}>ตรวจสอบรายละเอียดงาน คนขับ รถ จุดรับ จุดส่ง และเวลาปฏิบัติงานให้ถูกต้อง</Text>
                </View>
                <View style={styles.instructionRow}>
                  <Text style={styles.instructionNumber}>3</Text>
                  <Text style={styles.instructionText}>กดยืนยันตามขั้นตอนในหน้าคนขับ และอนุญาต GPS เมื่อระบบร้องขอ</Text>
                </View>
              </View>
              <Text style={styles.versionText}>เวอร์ชันระบบ {TOMP_DRIVER_APP_VERSION}</Text>
              {outboxCount > 0 ? <Text style={styles.noteText}>รายการที่รอส่งซ้ำ: {outboxCount}</Text> : null}
              {syncLabel ? <Text style={styles.noteText}>{syncLabel}</Text> : null}
            </View>
          </ScrollView>
        )}
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

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.command,
    flex: 1
  },
  shell: {
    backgroundColor: colors.canvas,
    flex: 1
  },
  fontLoading: {
    alignItems: "center",
    backgroundColor: colors.command,
    flex: 1,
    justifyContent: "center"
  },
  topbar: {
    alignItems: "center",
    backgroundColor: colors.command,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: space.md,
    paddingHorizontal: space.lg
  },
  identity: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  product: {
    color: colors.accent,
    fontFamily: font.bold,
    ...text.display
  },
  title: {
    color: colors.onCommand,
    fontFamily: font.semibold,
    ...text.caption
  },
  statusGroup: {
    alignItems: "flex-end",
    flexShrink: 0,
    gap: space.xs
  },
  localeSwitch: {
    backgroundColor: overlay.faint,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: 2,
    padding: 2
  },
  // The one control deliberately under TOUCH_MIN: a language toggle is a
  // settings affordance, not something reached for while moving, and two 44pt
  // chips would own the header.
  localeButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: space.md
  },
  localeButtonActive: {
    backgroundColor: colors.accent
  },
  localeButtonText: {
    color: colors.onCommandMuted,
    fontFamily: font.bold,
    ...text.micro
  },
  localeButtonTextActive: {
    color: colors.command
  },
  statusPill: {
    backgroundColor: overlay.soft,
    borderRadius: radius.pill,
    color: colors.surface,
    fontFamily: font.bold,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    ...text.caption
  },
  network: {
    borderRadius: radius.pill,
    color: colors.onCommandMuted,
    fontFamily: font.semibold,
    overflow: "hidden",
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    ...text.micro
  },
  networkLive: {
    backgroundColor: overlay.successFill,
    color: colors.successOnDark
  },
  networkIdle: {
    backgroundColor: overlay.warningFill,
    color: colors.warningOnDark
  },
  networkOffline: {
    backgroundColor: overlay.dangerFill,
    color: colors.dangerOnDark
  },
  outboxText: {
    color: colors.warningOnDark,
    fontFamily: font.bold,
    ...text.micro
  },
  syncText: {
    color: colors.accent,
    fontFamily: font.semibold,
    maxWidth: 180,
    textAlign: "right",
    ...text.micro
  },
  activationScroller: {
    flex: 1
  },
  activation: {
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.lg
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.xl,
    borderWidth: 1,
    elevation: 3,
    padding: space.lg,
    shadowColor: colors.ink,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.07,
    shadowRadius: 18
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
    elevation: 2,
    gap: space.sm,
    padding: space.lg,
    shadowColor: colors.ink,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 14
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
    justifyContent: "center",
    minHeight: TOUCH_MIN
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
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.operationSoft,
    borderRadius: radius.xl,
    borderWidth: 1,
    elevation: 1,
    gap: space.md,
    padding: space.lg,
    shadowColor: colors.ink,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 12
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
  versionText: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: font.semibold,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    ...text.caption
  },
  noteText: {
    color: colors.muted,
    fontFamily: font.regular,
    ...text.caption
  },
  webContainer: {
    backgroundColor: colors.surface,
    flex: 1
  },
  operationStrip: {
    alignItems: "center",
    backgroundColor: colors.surfaceSoft,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: space.sm,
    justifyContent: "space-between",
    paddingHorizontal: space.md,
    paddingVertical: space.sm
  },
  operationStatusItem: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: space.sm
  },
  statusDot: {
    borderRadius: radius.pill,
    height: 10,
    width: 10
  },
  statusDotOk: {
    backgroundColor: colors.success
  },
  statusDotPending: {
    backgroundColor: colors.warning
  },
  operationStatusCopy: {
    flex: 1
  },
  operationStatusTitle: {
    color: colors.ink,
    fontFamily: font.bold,
    ...text.caption
  },
  operationStatusText: {
    color: colors.muted,
    fontFamily: font.regular,
    ...text.micro
  },
  webVersionText: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.muted,
    flexShrink: 0,
    fontFamily: font.semibold,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    ...text.micro
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
  locationAssist: {
    backgroundColor: colors.operationSoft,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm
  },
  locationAssistCopy: {
    flex: 1,
    gap: 2
  },
  locationAssistTitle: {
    color: colors.operationDeep,
    fontFamily: font.bold,
    ...text.caption
  },
  locationAssistText: {
    color: colors.muted,
    fontFamily: font.regular,
    ...text.micro
  },
  locationActionGroup: {
    flexDirection: "row",
    gap: space.sm
  },
  locationSettingsButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: TOUCH_MIN,
    paddingHorizontal: space.sm
  },
  locationSettingsButtonText: {
    color: colors.ink,
    fontFamily: font.semibold,
    ...text.micro
  },
  locationResetButton: {
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
  locationResetButtonText: {
    color: colors.warning,
    fontFamily: font.semibold,
    textAlign: "center",
    ...text.micro
  },
  webFrame: {
    flex: 1
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
  loadingText: {
    color: colors.muted,
    fontFamily: font.semibold,
    ...text.body
  },
  bottomBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    elevation: 14,
    flexDirection: "row",
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingTop: space.md,
    shadowColor: colors.ink,
    shadowOffset: { height: -4, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 12
  },
  menuButton: {
    alignItems: "center",
    borderRadius: radius.lg,
    flex: 1,
    justifyContent: "center",
    minHeight: TOUCH_MIN,
    paddingHorizontal: 2,
    position: "relative"
  },
  menuButtonActive: {
    backgroundColor: colors.operation
  },
  menuButtonUnread: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerLine,
    borderWidth: 1
  },
  menuButtonText: {
    color: colors.muted,
    fontFamily: font.semibold,
    textAlign: "center",
    ...text.micro
  },
  menuButtonTextActive: {
    color: colors.surface
  },
  menuBadge: {
    backgroundColor: colors.danger,
    borderColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 12,
    position: "absolute",
    right: 10,
    top: 7,
    width: 12,
    zIndex: 2
  },
  bottomPrimaryButton: {
    alignItems: "center",
    backgroundColor: colors.operation,
    borderRadius: radius.md,
    flex: 1,
    justifyContent: "center",
    minHeight: TOUCH_MIN,
    paddingHorizontal: space.md
  },
  // These two carried a fontWeight and no fontFamily, so they rendered in the
  // system font while everything around them was Noto Sans Thai.
  bottomPrimaryButtonText: {
    color: colors.surface,
    fontFamily: font.bold,
    ...text.body
  },
  bottomSecondaryButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: TOUCH_MIN,
    paddingHorizontal: space.md
  },
  bottomSecondaryButtonText: {
    color: colors.ink,
    fontFamily: font.semibold,
    ...text.body
  }
});
