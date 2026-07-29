import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import type { LocationObject, LocationSubscription } from "expo-location";
import * as ExpoLinking from "expo-linking";
import { getNextDriverAction, mapDriverStatusToThai } from "@tomp/driver-core";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { colors, radius } from "./src/theme";
import type { DriverScreenState, MobileDriverAssignment } from "./src/types";
import { fetchAssignmentByToken, submitIssue, submitReadiness, submitStatus } from "./src/services/driver-api";
import { clearDriverToken, getSavedDriverToken, saveDriverToken } from "./src/services/token-store";
import {
  requestBackgroundLocationPermission,
  requestForegroundLocationPermission,
  startBackgroundLocationSharing,
  startForegroundLocationSharing,
  stopLocationSharing
} from "./src/services/location";

function extractToken(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("tomp_")) return trimmed;
  try {
    const url = new URL(trimmed);
    const tokenParam = url.searchParams.get("token");
    if (tokenParam) return tokenParam;
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? trimmed;
  } catch {
    return trimmed;
  }
}

function formatLocation(location: LocationObject | null) {
  if (!location) return "ยังไม่มีตำแหน่งล่าสุด";
  return `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`;
}

export default function App() {
  const [screenState, setScreenState] = useState<DriverScreenState>("token");
  const [tokenInput, setTokenInput] = useState("");
  const [assignment, setAssignment] = useState<MobileDriverAssignment | null>(null);
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState<LocationObject | null>(null);
  const [locationSharing, setLocationSharing] = useState(false);
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);
  const [subscription, setSubscription] = useState<LocationSubscription | null>(null);

  const nextAction = useMemo(() => (assignment ? getNextDriverAction(assignment.packet.status) : "โหลดงานจาก QR ก่อน"), [assignment]);

  async function loadAssignment(rawToken: string) {
    const token = extractToken(rawToken);
    if (!token) {
      setMessage("กรุณาใส่ token หรือเปิดลิงก์จาก QR");
      return;
    }
    setScreenState("loading");
    setMessage("กำลังโหลดงานจากศูนย์ควบคุม");
    const result = await fetchAssignmentByToken(token);
    if (!result.success || !result.data) {
      setScreenState("error");
      setMessage(result.error ?? "โหลดงานไม่สำเร็จ");
      return;
    }
    await saveDriverToken(token);
    setAssignment(result.data);
    setTokenInput(token);
    setMessage("โหลดงานสำเร็จ");
    setScreenState("ready");
  }

  async function sendReadiness() {
    if (!assignment) return;
    const result = await submitReadiness({
      projectId: assignment.project.id,
      assignmentId: assignment.assignment.id,
      driverId: assignment.driver.id,
      status: "ready",
      confirmedName: true,
      confirmedPhone: true,
      confirmedVehicle: true,
      gpsConsent: true,
      metadata: { source: "mobile_driver" }
    });
    setMessage(result.success ? "ส่งข้อมูลความพร้อมแล้ว" : result.error ?? "ส่งข้อมูลความพร้อมไม่สำเร็จ");
  }

  async function sendStatus(status: "ready" | "arrived_pickup" | "passenger_onboard" | "completed" | "blocked") {
    if (!assignment) return;
    const result = await submitStatus({
      projectId: assignment.project.id,
      assignmentId: assignment.assignment.id,
      driverId: assignment.driver.id,
      status,
      source: "driver_qr",
      metadata: { source: "mobile_driver" }
    });
    setMessage(result.success ? `ส่งสถานะ ${mapDriverStatusToThai(status)} แล้ว` : result.error ?? "ส่งสถานะไม่สำเร็จ");
  }

  async function reportIssue() {
    if (!assignment) return;
    const result = await submitIssue({
      projectId: assignment.project.id,
      assignmentId: assignment.assignment.id,
      driverId: assignment.driver.id,
      issueType: "driver_needs_help",
      severity: "urgent",
      message: "คนขับกดแจ้งปัญหาจากแอปมือถือ",
      metadata: { source: "mobile_driver" }
    });
    setMessage(result.success ? "แจ้งปัญหาไปยังศูนย์ควบคุมแล้ว" : result.error ?? "แจ้งปัญหาไม่สำเร็จ");
  }

  async function toggleLocationSharing() {
    if (!assignment) return;
    if (locationSharing) {
      subscription?.remove();
      setSubscription(null);
      await stopLocationSharing(assignment.token);
      setLocationSharing(false);
      setBackgroundEnabled(false);
      setMessage("หยุดแชร์ตำแหน่งแล้ว");
      return;
    }

    const foregroundGranted = await requestForegroundLocationPermission();
    if (!foregroundGranted) {
      Alert.alert("ต้องอนุญาตตำแหน่ง", "กรุณาอนุญาต Location เพื่อแชร์ตำแหน่งระหว่างปฏิบัติงาน");
      return;
    }
    const watcher = await startForegroundLocationSharing(assignment.token, setLocation);
    setSubscription(watcher);
    setLocationSharing(true);
    setMessage("เริ่มแชร์ตำแหน่งแล้ว");

    const backgroundGranted = await requestBackgroundLocationPermission().catch(() => false);
    if (backgroundGranted) {
      const started = await startBackgroundLocationSharing().catch(() => false);
      setBackgroundEnabled(started);
    }
  }

  async function resetToken() {
    subscription?.remove();
    if (assignment) await stopLocationSharing(assignment.token).catch(() => undefined);
    await clearDriverToken();
    setAssignment(null);
    setTokenInput("");
    setLocation(null);
    setLocationSharing(false);
    setBackgroundEnabled(false);
    setScreenState("token");
    setMessage("ล้าง token แล้ว");
  }

  useEffect(() => {
    getSavedDriverToken().then((savedToken) => {
      if (savedToken) void loadAssignment(savedToken);
    });

    const subscription = ExpoLinking.addEventListener("url", ({ url }) => {
      void loadAssignment(url);
    });

    ExpoLinking.getInitialURL().then((url) => {
      if (url) void loadAssignment(url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ExpoStatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.kicker}>TOMP DRIVER APP</Text>
          <Text style={styles.title}>งานของคุณวันนี้</Text>
          <Text style={styles.subtitle}>แอปคนขับสำหรับรับงาน แชร์ GPS และส่งสถานะกลับศูนย์ควบคุม</Text>
        </View>

        {screenState === "loading" ? (
          <View style={styles.panel}>
            <ActivityIndicator color={colors.operation} />
            <Text style={styles.panelText}>กำลังโหลดข้อมูลงาน</Text>
          </View>
        ) : null}

        {!assignment ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>เปิดงานจาก QR</Text>
            <Text style={styles.panelText}>สแกน QR ด้วยกล้องมือถือแล้วเปิดลิงก์ หรือใส่ token ที่ศูนย์ควบคุมสร้างให้</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setTokenInput}
              placeholder="วาง token หรือ URL จาก QR"
              placeholderTextColor="#8795a5"
              style={styles.input}
              value={tokenInput}
            />
            <Pressable style={styles.primaryButton} onPress={() => loadAssignment(tokenInput)}>
              <Text style={styles.primaryButtonText}>โหลดงาน</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.commandCard}>
              <Text style={styles.commandKicker}>Call Sign</Text>
              <Text style={styles.callSign}>{assignment.callSign.callSign}</Text>
              <Text style={styles.commandText}>{assignment.project.projectName}</Text>
              <Text style={styles.commandText}>{assignment.driver.fullName} · {assignment.vehicle.plateNumber}</Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>งานถัดไปที่ต้องทำ</Text>
              <Text style={styles.nextAction}>{nextAction}</Text>
              <View style={styles.routeBox}>
                <Text style={styles.routeLabel}>จุดรับ</Text>
                <Text style={styles.routeValue}>{assignment.route.pickupLabel}</Text>
                <Text style={styles.routeLabel}>จุดส่ง</Text>
                <Text style={styles.routeValue}>{assignment.route.dropoffLabel}</Text>
                <Text style={styles.routeLabel}>เวลาที่ต้องถึง</Text>
                <Text style={styles.routeValue}>{assignment.route.commitmentTime}</Text>
              </View>
              <Pressable style={styles.routeButton} onPress={() => Linking.openURL(assignment.route.mapsUrl)}>
                <Text style={styles.routeButtonText}>เปิด Google Maps</Text>
              </Pressable>
            </View>

            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>ความพร้อมและสถานะ</Text>
              <Pressable style={styles.primaryButton} onPress={sendReadiness}>
                <Text style={styles.primaryButtonText}>ส่งข้อมูลความพร้อม</Text>
              </Pressable>
              <View style={styles.statusGrid}>
                <StatusButton label="พร้อมเริ่มงาน" onPress={() => sendStatus("ready")} />
                <StatusButton label="ถึงจุดรับแล้ว" onPress={() => sendStatus("arrived_pickup")} />
                <StatusButton label="รับผู้โดยสารแล้ว" onPress={() => sendStatus("passenger_onboard")} />
                <StatusButton label="เสร็จสิ้นงาน" onPress={() => sendStatus("completed")} />
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>แชร์ตำแหน่ง GPS</Text>
              <Text style={styles.panelText}>ตำแหน่งนี้ผูกกับโครงการ Assignment Call Sign และคนขับจาก token ของงานนี้</Text>
              <Text style={styles.locationText}>{formatLocation(location)}</Text>
              <Pressable style={[styles.primaryButton, locationSharing ? styles.stopButton : null]} onPress={toggleLocationSharing}>
                <Text style={styles.primaryButtonText}>{locationSharing ? "หยุดแชร์ตำแหน่ง" : "เริ่มแชร์ตำแหน่ง"}</Text>
              </Pressable>
              <Text style={styles.smallText}>{backgroundEnabled ? "เปิด background location แล้วตามที่ระบบมือถืออนุญาต" : "หากต้องการอัปเดตตอนสลับแอป ให้กดอนุญาตตำแหน่งเบื้องหลังเมื่อระบบถาม"}</Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>ติดต่อและแจ้งปัญหา</Text>
              <Pressable style={styles.warningButton} onPress={reportIssue}>
                <Text style={styles.warningButtonText}>แจ้งปัญหาไปศูนย์ควบคุม</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={resetToken}>
                <Text style={styles.secondaryButtonText}>ออกจากงานนี้</Text>
              </Pressable>
            </View>
          </>
        )}

        {message ? <Text style={screenState === "error" ? styles.errorMessage : styles.message}>{message}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.statusButton} onPress={onPress}>
      <Text style={styles.statusButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas
  },
  container: {
    gap: 16,
    padding: 18,
    paddingBottom: 40
  },
  header: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: 20
  },
  kicker: {
    color: colors.operation,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 36,
    marginTop: 8
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  panelText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800"
  },
  input: {
    backgroundColor: "#f8fbfd",
    borderColor: "#cdd9e5",
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.operation,
    borderRadius: radius.md,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 18
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800"
  },
  commandCard: {
    backgroundColor: colors.command,
    borderRadius: radius.xl,
    gap: 8,
    padding: 22
  },
  commandKicker: {
    color: "#9cf1e8",
    fontSize: 12,
    fontWeight: "800"
  },
  callSign: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "900",
    lineHeight: 50
  },
  commandText: {
    color: "#d9e6f0",
    fontSize: 14,
    lineHeight: 22
  },
  nextAction: {
    color: colors.operationDeep,
    fontSize: 22,
    fontWeight: "900"
  },
  routeBox: {
    backgroundColor: "#f5f9fc",
    borderRadius: radius.md,
    gap: 4,
    padding: 14
  },
  routeLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 6
  },
  routeValue: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24
  },
  routeButton: {
    alignItems: "center",
    backgroundColor: colors.route,
    borderRadius: radius.md,
    justifyContent: "center",
    minHeight: 54
  },
  routeButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800"
  },
  statusGrid: {
    gap: 10
  },
  statusButton: {
    alignItems: "center",
    backgroundColor: "#ecf6f4",
    borderColor: "#b8ddd8",
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 50
  },
  statusButtonText: {
    color: colors.operationDeep,
    fontSize: 15,
    fontWeight: "800"
  },
  locationText: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800"
  },
  smallText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18
  },
  stopButton: {
    backgroundColor: colors.danger
  },
  warningButton: {
    alignItems: "center",
    backgroundColor: "#fff3df",
    borderColor: "#ffd391",
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52
  },
  warningButtonText: {
    color: "#8a4b00",
    fontSize: 15,
    fontWeight: "800"
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48
  },
  secondaryButtonText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "800"
  },
  message: {
    backgroundColor: "#e7f6f3",
    borderRadius: radius.md,
    color: colors.operationDeep,
    fontSize: 14,
    fontWeight: "700",
    padding: 12
  },
  errorMessage: {
    backgroundColor: "#ffe8e7",
    borderRadius: radius.md,
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
    padding: 12
  }
});
