import type { ComponentType, RefAttributes } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
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
import { buildNativeStatusMessage, parseBridgeMessage } from "./src/bridge/protocol";
import { buildDriverWebUrl, TOMP_API_BASE_URL, TOMP_DRIVER_APP_VERSION, TOMP_WEB_ORIGIN } from "./src/config";
import { colors, radius } from "./src/theme";
import {
  requestBackgroundLocationPermission,
  requestForegroundLocationPermission,
  startBackgroundLocationSharing,
  startForegroundLocationSharing,
  stopLocationSharing
} from "./src/services/location";
import { getMobileDriverSession, saveMobileDriverSession } from "./src/services/mobile-session-store";
import { clearDriverToken, getSavedDriverToken, saveDriverToken } from "./src/services/token-store";
import { parseDriverLink } from "./src/services/driver-link";
import { decideWebViewNavigation } from "./src/services/webview-navigation";

const DriverWebView = WebView as unknown as ComponentType<WebViewProps & RefAttributes<WebView>>;

type ShellMode = "activation" | "web";
type ShellStatus = "พร้อมเปิดงาน" | "กำลังเปิดงาน" | "กำลังใช้งาน" | "ต้องตรวจสอบ";

const bridgeBootstrap = `
  (function () {
    window.TOMP_MOBILE_SHELL = {
      namespace: "tomp.driver",
      version: 1,
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
  const [qrLocked, setQrLocked] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [message, setMessage] = useState("สแกน QR หรือวาง URL งานที่ได้รับจากศูนย์ควบคุม");
  const [sessionReady, setSessionReady] = useState(false);
  const [networkLabel, setNetworkLabel] = useState("กำลังตรวจสอบสัญญาณ");
  const [canGoBack, setCanGoBack] = useState(false);

  const effectiveWebUrl = useMemo(() => webUrl || (currentToken ? buildDriverWebUrl(currentToken) : ""), [currentToken, webUrl]);

  const postStatusToWeb = useCallback((nativeStatus: Parameters<typeof buildNativeStatusMessage>[0], text: string, detail?: Record<string, unknown>) => {
    const payload = buildNativeStatusMessage(nativeStatus, text, detail);
    const serialized = JSON.stringify(payload).replace(/\\/g, "\\\\").replace(/`/g, "\\`");
    webViewRef.current?.injectJavaScript(`
      window.dispatchEvent(new CustomEvent("tomp:native-status", { detail: ${serialized} }));
      true;
    `);
  }, []);

  const openDriverLink = useCallback(
    async (rawValue: string) => {
      const parsed = parseDriverLink(rawValue);
      if (!parsed) {
        setStatus("ต้องตรวจสอบ");
        setMessage("ไม่พบ token หรือ URL งาน กรุณาตรวจสอบ QR อีกครั้ง");
        return;
      }

      await saveDriverToken(parsed.token);
      setCurrentToken(parsed.token);
      setTokenInput(parsed.token);
      setWebUrl(parsed.webUrl);
      setScannerOpen(false);
      setQrLocked(false);
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
        postStatusToWeb("session_ready", "mobile session พร้อมสำหรับ GPS เบื้องหลัง");
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

      const session = await getMobileDriverSession();
      if (!session) {
        setSessionReady(false);
        postStatusToWeb("session_missing", "ยังไม่มี mobile session หลังยืนยัน PIN จึงยังไม่เริ่ม GPS เบื้องหลัง");
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

      const backgroundGranted = await requestBackgroundLocationPermission().catch(() => false);
      const backgroundStarted = backgroundGranted ? await startBackgroundLocationSharing().catch(() => false) : false;
      postStatusToWeb(backgroundStarted ? "gps_sharing" : "gps_error", backgroundStarted ? "เปิด GPS เบื้องหลังแล้ว" : "ยังไม่ได้รับสิทธิ์ GPS เบื้องหลัง");
    },
    [postStatusToWeb]
  );

  const handleNavigation = useCallback((event: WebViewNavigation) => {
    setCanGoBack(event.canGoBack);
    if (event.loading) {
      setStatus("กำลังเปิดงาน");
      return;
    }
    setStatus("กำลังใช้งาน");
    setMessage("เปิดหน้าคนขับผ่าน TOMP Web แล้ว");
  }, []);

  const handleShouldStartLoad = useCallback((request: { url: string }) => {
    const decision = decideWebViewNavigation(request.url);
    if (decision.action === "allow") return true;
    if (decision.action === "external") void Linking.openURL(decision.url);
    if (decision.action === "block") postStatusToWeb("navigation_blocked", decision.reason, { url: request.url });
    return false;
  }, [postStatusToWeb]);

  const resetAssignment = useCallback(async () => {
    await stopLocationSharing().catch(() => undefined);
    await clearDriverToken();
    setCurrentToken("");
    setWebUrl("");
    setMode("activation");
    setStatus("พร้อมเปิดงาน");
    setMessage("ออกจากงานแล้ว กรุณาสแกน QR ใหม่เมื่อได้รับงานถัดไป");
  }, []);

  useEffect(() => {
    getSavedDriverToken().then((savedToken) => {
      if (savedToken) void openDriverLink(savedToken);
    });
    getMobileDriverSession().then((session) => setSessionReady(Boolean(session)));
    Network.getNetworkStateAsync().then((state) => {
      setNetworkLabel(state.isConnected ? "ออนไลน์" : "ออฟไลน์");
    });

    const subscription = ExpoLinking.addEventListener("url", ({ url }) => {
      void openDriverLink(url);
    });

    ExpoLinking.getInitialURL().then((url) => {
      if (url) void openDriverLink(url);
    });

    return () => subscription.remove();
  }, [openDriverLink]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (mode === "web" && canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }
      if (mode === "web") {
        setMode("activation");
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [canGoBack, mode]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.command} />
      <ExpoStatusBar style="light" />
      <View style={styles.shell}>
        <View style={styles.topbar}>
          <View style={styles.identity}>
            <Text style={styles.product}>TOMP Driver</Text>
            <Text style={styles.title}>{mode === "web" ? "หน้าคนขับ" : "เปิดงานด้วย QR"}</Text>
          </View>
          <View style={styles.statusGroup}>
            <Text style={styles.statusPill}>{status}</Text>
            <Text style={styles.network}>{networkLabel}</Text>
          </View>
        </View>

        {mode === "web" && effectiveWebUrl ? (
          <View style={styles.webContainer}>
            <View style={styles.webMeta}>
              <Text style={styles.webMetaText}>Web: {TOMP_WEB_ORIGIN}</Text>
              <Text style={[styles.webMetaText, sessionReady ? styles.okText : styles.warningText]}>
                {sessionReady ? "mobile session พร้อม" : "รอ mobile session จาก Web"}
              </Text>
            </View>
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
            <View style={styles.bottomBar}>
              <Pressable style={styles.secondaryButton} onPress={resetAssignment}>
                <Text style={styles.secondaryButtonText}>ออกจากงาน</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={() => webViewRef.current?.reload()}>
                <Text style={styles.primaryButtonText}>รีเฟรช</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.activation}>
            <View style={styles.heroCard}>
              <Text style={styles.kicker}>สำหรับคนขับ</Text>
              <Text style={styles.heroTitle}>สแกน QR เพื่อเปิดงาน</Text>
              <Text style={styles.heroCopy}>แอปนี้ใช้สำหรับเปิดหน้าคนขับของ TOMP และเตรียม GPS เบื้องหลังสำหรับ Android</Text>
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
                <Text style={styles.primaryButtonText}>{scannerOpen ? "ปิดกล้อง" : "สแกน QR"}</Text>
              </Pressable>
              <Text style={styles.orText}>หรือวาง URL/token จากศูนย์ควบคุม</Text>
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
                <Text style={styles.secondaryButtonText}>เปิดงาน</Text>
              </Pressable>
            </View>

            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>สถานะระบบ</Text>
              <Text style={styles.noteText}>{message}</Text>
              <Text style={styles.noteText}>API: {TOMP_API_BASE_URL}</Text>
              <Text style={styles.noteText}>รุ่นแอป: {TOMP_DRIVER_APP_VERSION}</Text>
              {Platform.OS === "android" ? <Text style={styles.noteText}>Android: รองรับ development build สำหรับ GPS เบื้องหลัง</Text> : null}
            </View>
          </View>
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
    alignItems: "center",
    backgroundColor: colors.command,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14
  },
  identity: {
    flex: 1,
    gap: 2
  },
  product: {
    color: "#8be2da",
    fontSize: 12,
    fontWeight: "800"
  },
  title: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900"
  },
  statusGroup: {
    alignItems: "flex-end",
    gap: 5
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
    fontSize: 11,
    fontWeight: "700"
  },
  activation: {
    gap: 14,
    padding: 16
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: 20
  },
  kicker: {
    color: colors.operationDeep,
    fontSize: 12,
    fontWeight: "900"
  },
  heroTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
    marginTop: 8
  },
  heroCopy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 12,
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
    gap: 5,
    padding: 14
  },
  noteTitle: {
    color: colors.operationDeep,
    fontSize: 14,
    fontWeight: "900"
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
  webMeta: {
    alignItems: "center",
    backgroundColor: "#f6fafc",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  webMetaText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700"
  },
  okText: {
    color: colors.success
  },
  warningText: {
    color: colors.warning
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
    gap: 10,
    padding: 10
  }
});
