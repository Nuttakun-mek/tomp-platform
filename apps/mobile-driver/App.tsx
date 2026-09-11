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
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import * as ExpoLinking from "expo-linking";
import * as Network from "expo-network";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { WebView, type WebViewProps } from "react-native-webview";
import type { WebViewMessageEvent, WebViewNavigation } from "react-native-webview/lib/WebViewTypes";
import { BRIDGE_NAMESPACE, BRIDGE_VERSION, buildNativeStatusMessage, parseBridgeMessage } from "./src/bridge/protocol";
import { buildDriverWebUrl, EAS_PROJECT_ID, TOMP_DRIVER_APP_VERSION, type DriverWebViewKey } from "./src/config";
import { colors, radius } from "./src/theme";
import {
  hasBackgroundLocationPermission,
  isForegroundSharing,
  requestBackgroundLocationPermission,
  requestForegroundLocationPermission,
  startBackgroundLocationSharing,
  startForegroundLocationSharing,
  stopLocationSharing,
  stopStaleBackgroundLocationTask
} from "./src/services/location";
import { promptBatteryExemptionOnce } from "./src/services/battery";
import { exchangeMobileSessionChallenge } from "./src/services/mobile-session-api";
import { addNotificationTapListener, clearDeliveredNotifications, registerForPushNotifications, syncPushToken } from "./src/services/push";
import { getInstallationId, getMobileDriverSession, saveMobileDriverSession } from "./src/services/mobile-session-store";
import { flushOfflineQueue, getOfflineQueueCount } from "./src/services/offline-queue";
import { clearDriverToken, getSavedDriverToken, saveDriverToken } from "./src/services/token-store";
import { parseDriverLink } from "./src/services/driver-link";
import { decideWebViewNavigation } from "./src/services/webview-navigation";
import { mt, type MobileLocale } from "./src/i18n";
import { getMobileLocale, saveMobileLocale } from "./src/services/locale-store";

const DriverWebView = WebView as unknown as ComponentType<WebViewProps & RefAttributes<WebView>>;

type ShellMode = "activation" | "web";
type ShellStatus = "พร้อมเปิดงาน" | "กำลังเปิดงาน" | "กำลังใช้งาน" | "ต้องตรวจสอบ";
type DriverMenuKey = "home" | "next" | "messages" | "location";

const DRIVER_MENU_ITEMS: Array<{ key: DriverMenuKey; label: string; view?: DriverWebViewKey }> = [
  { key: "home", label: "หน้างาน", view: "home" },
  { key: "next", label: "งานต่อไป", view: "next" },
  { key: "messages", label: "ข้อความ", view: "messages" },
  { key: "location", label: "แชร์ตำแหน่ง", view: "gps" }
];

const bridgeBootstrap = `
  (function () {
    window.TOMP_MOBILE_SHELL = {
      namespace: "${BRIDGE_NAMESPACE}",
      version: ${BRIDGE_VERSION},
      platform: "android",
      appVersion: "${TOMP_DRIVER_APP_VERSION}",
      canBackgroundLocation: true,
      postMessage: function(message) {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }
    };
    window.dispatchEvent(new CustomEvent("tomp:mobile-shell-ready", { detail: window.TOMP_MOBILE_SHELL }));
  })();
  true;
`;

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [mode, setMode] = useState<ShellMode>("activation");
  const [status, setStatus] = useState<ShellStatus>("พร้อมเปิดงาน");
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
  const [canGoBack, setCanGoBack] = useState(false);
  const [outboxCount, setOutboxCount] = useState(0);
  const [syncLabel, setSyncLabel] = useState("");
  const [activeDriverMenu, setActiveDriverMenu] = useState<DriverMenuKey>("home");

  const activeWebView = useMemo(
    () => DRIVER_MENU_ITEMS.find((item) => item.key === activeDriverMenu)?.view ?? "home",
    [activeDriverMenu]
  );
  const effectiveWebUrl = useMemo(
    () => webUrl || (currentToken ? buildDriverWebUrl(currentToken, locale, activeWebView) : ""),
    [activeWebView, currentToken, locale, webUrl]
  );

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
        setStatus("ต้องตรวจสอบ");
        setMessage("ไม่พบ token หรือ URL งาน กรุณาตรวจสอบ QR อีกครั้ง");
        return;
      }

      await saveDriverToken(parsed.token);
      localeRef.current = parsed.locale;
      setLocale(parsed.locale);
      void saveMobileLocale(parsed.locale);
      setCurrentToken(parsed.token);
      setTokenInput(parsed.token);
      setWebUrl(buildDriverWebUrl(parsed.token, parsed.locale, "home"));
      setScannerOpen(false);
      setQrLocked(false);
      setActiveDriverMenu("home");
      setMode("web");
      setStatus("กำลังเปิดงาน");
      setMessage(parsed.source === "raw-token" ? "กำลังเปิดงานจาก token" : "กำลังเปิดงานจาก QR");
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

      if (parsed.type === "gps.stop") {
        await stopLocationSharing();
        postStatusToWeb("gps_stopped", "หยุดแชร์ตำแหน่งจากแอปแล้ว");
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
        postStatusToWeb("session_missing", "ยังไม่พร้อมส่งตำแหน่ง GPS เบื้องหลัง กรุณายืนยันงานในหน้าคนขับก่อน");
        return;
      }

      // A repeat gps.start (the web "share again" button) must not stack a
      // second watcher on top of the running one.
      if (isForegroundSharing()) {
        postStatusToWeb("gps_sharing", "กำลังแชร์ตำแหน่งจากแอปอยู่แล้ว");
        return;
      }

      const foregroundGranted = await requestForegroundLocationPermission();
      if (!foregroundGranted) {
        postStatusToWeb("gps_error", "ไม่ได้รับสิทธิ์ตำแหน่งขณะเปิดแอป");
        return;
      }

      postStatusToWeb("gps_starting", "กำลังเริ่มแชร์ตำแหน่งจากแอป");
      await startForegroundLocationSharing((location) => {
        postStatusToWeb("gps_sharing", "กำลังแชร์ตำแหน่งจากแอป", {
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
      const backgroundStarted = await startBackgroundLocationSharing();
      // Ask once, and only now: the driver has just chosen to share, so the
      // reason for the exemption is obvious to them.
      if (backgroundStarted) void promptBatteryExemptionOnce();
      postStatusToWeb(
        "gps_sharing",
        backgroundStarted
          ? "เปิด GPS เบื้องหลังแล้ว"
          : "แชร์ตำแหน่งขณะเปิดแอปแล้ว — เปิด GPS เบื้องหลังได้โดยตั้งค่าตำแหน่งเป็น อนุญาตตลอดเวลา"
      );
    },
    [flushOutbox, postStatusToWeb]
  );

  const handleNavigation = useCallback(
    (event: WebViewNavigation) => {
      setCanGoBack(event.canGoBack);
      if (event.loading) {
        setStatus("กำลังเปิดงาน");
        return;
      }
      setStatus("กำลังใช้งาน");
      setMessage("เปิดหน้าคนขับผ่าน TOMP Web แล้ว");

      // The page loads with no idea what the shell is doing, so it offered
      // "share again" while sharing was already running. Tell it the truth.
      if (isForegroundSharing()) {
        postStatusToWeb("gps_sharing", "กำลังแชร์ตำแหน่งจากแอปอยู่");
      }
    },
    [postStatusToWeb]
  );

  const handleShouldStartLoad = useCallback((request: { url: string }) => {
    const decision = decideWebViewNavigation(request.url);
    if (decision.action === "allow") return true;
    if (decision.action === "external") void Linking.openURL(decision.url);
    if (decision.action === "block") postStatusToWeb("navigation_blocked", decision.reason, { url: request.url });
    return false;
  }, [postStatusToWeb]);

  const openDriverMenu = useCallback((item: { key: DriverMenuKey; view?: DriverWebViewKey }) => {
    setActiveDriverMenu(item.key);
    if (currentToken && item.view) setWebUrl(buildDriverWebUrl(currentToken, localeRef.current, item.view));
  }, [currentToken]);

  const resetAssignment = useCallback(async () => {
    await stopLocationSharing().catch(() => undefined);
    await clearDriverToken();
    setCurrentToken("");
    setWebUrl("");
    setMode("activation");
    setStatus("พร้อมเปิดงาน");
    setActiveDriverMenu("home");
    setMessage("ออกจากงานแล้ว กรุณาสแกน QR ใหม่เมื่อได้รับงานถัดไป");
  }, []);

  const confirmResetAssignment = useCallback(() => {
    Alert.alert(
      "ออกจากงานนี้",
      "ต้องการออกจากงานนี้หรือไม่ ระบบจะหยุดแชร์ตำแหน่งและกลับไปหน้าเปิดงานด้วย QR",
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
      setNetworkLabel(state.isConnected ? "ออนไลน์" : "ออฟไลน์");
    });

    // Tapping a dispatch notification should land on the job, not just open the
    // shell — the driver is being told to look at something.
    const tapSubscription = addNotificationTapListener(() => {
      setMode("web");
      webViewRef.current?.reload();
      void clearDeliveredNotifications();
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
    };
  }, [flushOutbox, openDriverLink]);

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        void flushOutbox();
        // The driver is looking at the app, so anything still queued in the
        // shade has been seen. Clearing it here is what actually brings the
        // launcher badge back down.
        void clearDeliveredNotifications();
        Network.getNetworkStateAsync().then((state) => {
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.command} />
      <ExpoStatusBar style="light" />
      <View style={styles.shell}>
        <View style={styles.topbar}>
          <View style={styles.identity}>
            <Text style={styles.product}>TOMP Driver</Text>
            {mode === "web" ? <Text style={styles.title}>{mt(locale, "driverPage")}</Text> : null}
          </View>
          <View style={styles.statusGroup}>
            <View style={styles.localeSwitch}>
              {(["th", "en"] as const).map((item) => (
                <Pressable key={item} onPress={() => changeLocale(item)} style={[styles.localeButton, locale === item && styles.localeButtonActive]}>
                  <Text style={[styles.localeButtonText, locale === item && styles.localeButtonTextActive]}>{item.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
            {mode === "web" ? <Text style={styles.statusPill}>{status}</Text> : null}
            <Text style={styles.network}>{networkLabel}</Text>
            {outboxCount > 0 ? <Text style={styles.outboxText}>ค้างส่ง {outboxCount} รายการ</Text> : null}
            {syncLabel ? <Text style={styles.syncText}>{syncLabel}</Text> : null}
          </View>
        </View>

        {mode === "web" && effectiveWebUrl ? (
          <View style={styles.webContainer}>
            <View style={styles.operationStrip}>
              <View style={styles.operationStatusItem}>
                <View style={[styles.statusDot, sessionReady ? styles.statusDotOk : styles.statusDotPending]} />
                <View style={styles.operationStatusCopy}>
                  <Text style={styles.operationStatusTitle}>{sessionReady ? "เชื่อมต่อศูนย์ควบคุมแล้ว" : "กำลังเตรียมการเชื่อมต่อ"}</Text>
                  <Text style={styles.operationStatusText}>
                    {sessionReady ? "พร้อมส่งสถานะและตำแหน่งระหว่างปฏิบัติงาน" : "กรุณายืนยันงานในหน้าคนขับเพื่อเปิดการส่งข้อมูล"}
                  </Text>
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
              <View style={styles.locationAssist}>
                <View style={styles.locationAssistCopy}>
                  <Text style={styles.locationAssistTitle}>การแชร์ตำแหน่ง</Text>
                  <Text style={styles.locationAssistText}>
                    ใช้หน้านี้เพื่อเริ่มแชร์ GPS ตรวจสอบสิทธิ์ตำแหน่ง และเปิดการตั้งค่าอุปกรณ์เมื่อระบบแจ้งว่าต้องตรวจสอบ
                  </Text>
                </View>
                <Pressable style={styles.locationSettingsButton} onPress={() => Linking.openSettings()}>
                  <Text style={styles.locationSettingsButtonText}>ตั้งค่าอุปกรณ์</Text>
                </Pressable>
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
                startInLoadingState
                renderLoading={() => (
                  <View style={styles.loading}>
                    <ActivityIndicator color={colors.operation} />
                    <Text style={styles.loadingText}>กำลังเปิดหน้าคนขับ</Text>
                  </View>
                )}
              />
            </View>
            <View style={styles.bottomBar}>
              {DRIVER_MENU_ITEMS.map((item) => (
                <Pressable
                  key={item.key}
                  style={[styles.menuButton, activeDriverMenu === item.key && styles.menuButtonActive]}
                  onPress={() => openDriverMenu(item)}
                >
                  <Text style={[styles.menuButtonText, activeDriverMenu === item.key && styles.menuButtonTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <ScrollView style={styles.activationScroller} contentContainerStyle={styles.activation} keyboardShouldPersistTaps="handled">
            <View style={styles.heroCard}>
              <Text style={styles.kicker}>พื้นที่ปฏิบัติงานคนขับ</Text>
              <Text style={styles.heroTitle}>รับงานผ่าน QR จากศูนย์ควบคุม</Text>
              <Text style={styles.heroCopy}>
                สแกน QR ที่ได้รับจากเจ้าหน้าที่ เพื่อเปิดรายละเอียดงาน ยืนยันตัวตน และเริ่มส่งตำแหน่ง GPS ระหว่างปฏิบัติงาน
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
                    placeholderTextColor="#7d8b99"
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
    </SafeAreaView>
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
  topbar: {
    alignItems: "flex-start",
    backgroundColor: colors.command,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) + 18 : 22
  },
  identity: {
    flex: 1,
    gap: 3,
    paddingTop: 4
  },
  product: {
    color: "#8be2da",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.3
  },
  title: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900"
  },
  statusGroup: {
    alignItems: "flex-end",
    gap: 8,
    paddingTop: 2
  },
  localeSwitch: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: 2,
    padding: 2
  },
  localeButton: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  localeButtonActive: {
    backgroundColor: "#8be2da"
  },
  localeButtonText: {
    color: "#bdd1df",
    fontSize: 10,
    fontWeight: "900"
  },
  localeButtonTextActive: {
    color: colors.command
  },
  statusPill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.pill,
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  network: {
    color: "#bdd1df",
    fontSize: 12,
    fontWeight: "700"
  },
  outboxText: {
    color: "#ffd166",
    fontSize: 11,
    fontWeight: "800"
  },
  syncText: {
    color: "#8be2da",
    fontSize: 10,
    fontWeight: "800",
    maxWidth: 180,
    textAlign: "right"
  },
  activationScroller: {
    flex: 1
  },
  activation: {
    gap: 14,
    paddingBottom: Platform.OS === "android" ? 46 : 28,
    paddingHorizontal: 16,
    paddingTop: 16
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 18
  },
  kicker: {
    color: colors.operationDeep,
    fontSize: 12,
    fontWeight: "900"
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 31,
    marginTop: 8
  },
  heroCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 10,
    padding: 16
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.operation,
    borderRadius: radius.md,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 18
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900"
  },
  manualToggle: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36
  },
  manualToggleText: {
    color: colors.operationDeep,
    fontSize: 13,
    fontWeight: "900"
  },
  manualEntryBox: {
    gap: 10
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "900"
  },
  orText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center"
  },
  input: {
    backgroundColor: "#f8fbfd",
    borderColor: "#cbd7e3",
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14
  },
  scannerBox: {
    backgroundColor: "#061421",
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
    borderColor: "rgba(255,255,255,0.85)",
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
    backgroundColor: "rgba(6,20,33,0.78)",
    borderRadius: radius.pill,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  noteCard: {
    backgroundColor: "#f6faf9",
    borderColor: "#cce6e3",
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  noteTitle: {
    color: colors.operationDeep,
    fontSize: 14,
    fontWeight: "900"
  },
  instructionList: {
    gap: 10
  },
  instructionRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10
  },
  instructionNumber: {
    backgroundColor: "#dff3f1",
    borderRadius: radius.pill,
    color: colors.operationDeep,
    fontSize: 12,
    fontWeight: "900",
    height: 24,
    lineHeight: 24,
    textAlign: "center",
    width: 24
  },
  instructionText: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    lineHeight: 20
  },
  versionText: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderColor: "#dbe5ee",
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  noteText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18
  },
  webContainer: {
    backgroundColor: colors.surface,
    flex: 1
  },
  operationStrip: {
    alignItems: "center",
    backgroundColor: "#f7fbfc",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  operationStatusItem: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 9
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
    fontSize: 12,
    fontWeight: "900"
  },
  operationStatusText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 14
  },
  webVersionText: {
    backgroundColor: "#ffffff",
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.muted,
    flexShrink: 0,
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  syncNotice: {
    backgroundColor: "#fff8e7",
    borderBottomColor: "#f1d294",
    borderBottomWidth: 1,
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  syncNoticeText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15
  },
  locationAssist: {
    alignItems: "center",
    backgroundColor: "#eefaf8",
    borderBottomColor: "#cce6e3",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  locationAssistCopy: {
    flex: 1,
    gap: 2
  },
  locationAssistTitle: {
    color: colors.operationDeep,
    fontSize: 12,
    fontWeight: "900"
  },
  locationAssistText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 14
  },
  locationSettingsButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 10
  },
  locationSettingsButtonText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900"
  },
  webFrame: {
    flex: 1
  },
  loading: {
    alignItems: "center",
    backgroundColor: colors.surface,
    bottom: 0,
    gap: 10,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  bottomBar: {
    backgroundColor: "#ffffff",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingBottom: Platform.OS === "android" ? 18 : 10,
    paddingHorizontal: 8,
    paddingTop: 10
  },
  menuButton: {
    alignItems: "center",
    borderRadius: radius.md,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 2
  },
  menuButtonActive: {
    backgroundColor: colors.operation
  },
  menuButtonText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center"
  },
  menuButtonTextActive: {
    color: "#ffffff"
  },
  bottomPrimaryButton: {
    alignItems: "center",
    backgroundColor: colors.operation,
    borderRadius: radius.md,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 14
  },
  bottomPrimaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900"
  },
  bottomSecondaryButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 14
  },
  bottomSecondaryButtonText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  }
});
