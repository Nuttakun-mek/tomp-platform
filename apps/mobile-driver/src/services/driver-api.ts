import type { AssignmentStatusUpdateInput, DriverCheckinInput, DriverIssueReportInput, DriverLocationUpdateInput } from "@tomp/types/schemas";
import { TOMP_API_BASE_URL } from "../config";
import type { MobileDriverAssignment } from "../types";
import type { MobileDriverSession } from "./mobile-session-store";

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  statusCode?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function timeoutSignal(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cancel: () => clearTimeout(timeout) };
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const timeout = timeoutSignal();
  try {
    const response = await fetch(`${TOMP_API_BASE_URL}${path}`, {
      ...init,
      signal: init?.signal ?? timeout.signal,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {})
      }
    });
    const payload = (await response.json().catch(() => null)) as ApiResult<T> | null;
    if (!payload) return { success: false, error: `ไม่สามารถอ่านผลลัพธ์จากระบบได้ (${response.status})`, statusCode: response.status };
    if (!response.ok && payload.success !== false) {
      return { success: false, error: payload.error ?? `ระบบตอบกลับไม่สำเร็จ (${response.status})`, statusCode: response.status };
    }
    return { ...payload, success: payload.success !== false, statusCode: response.status };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error && error.name === "AbortError" ? "การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่" : error instanceof Error ? error.message : "เชื่อมต่อระบบไม่สำเร็จ"
    };
  } finally {
    timeout.cancel();
  }
}

export async function fetchAssignmentBySession(mobileSession?: MobileDriverSession | null) {
  if (!mobileSession?.session) {
    return {
      success: false,
      error: "ยังไม่มี mobile session สำหรับอ่านข้อมูลงาน กรุณาเปิดงานจาก QR และยืนยันรหัสก่อน",
      statusCode: 401
    };
  }

  return requestJson<MobileDriverAssignment>("/api/driver/assignment", {
    headers: { "x-driver-session": mobileSession.session }
  });
}

export async function submitLocation(input: DriverLocationUpdateInput, mobileSession?: MobileDriverSession | null) {
  if (!mobileSession?.session) {
    return {
      success: false,
      error: "ยังไม่มี mobile session สำหรับส่งตำแหน่งเบื้องหลัง",
      statusCode: 401
    };
  }

  return requestJson<{ id: string; recordedAt: string }>("/api/driver/location", {
    method: "POST",
    headers: { "x-driver-session": mobileSession.session },
    body: JSON.stringify(input)
  });
}

export async function submitReadiness(input: DriverCheckinInput, mobileSession?: MobileDriverSession | null) {
  if (!mobileSession?.session) {
    return { success: false, error: "ยังไม่มี mobile session สำหรับส่งข้อมูลความพร้อม", statusCode: 401 };
  }

  return requestJson<unknown>("/api/driver/readiness", {
    method: "POST",
    headers: { "x-driver-session": mobileSession.session },
    body: JSON.stringify(input)
  });
}

export async function submitStatusUpdate(input: AssignmentStatusUpdateInput, mobileSession?: MobileDriverSession | null) {
  if (!mobileSession?.session) {
    return { success: false, error: "ยังไม่มี mobile session สำหรับส่งสถานะงาน", statusCode: 401 };
  }

  return requestJson<unknown>("/api/driver/status", {
    method: "POST",
    headers: { "x-driver-session": mobileSession.session },
    body: JSON.stringify(input)
  });
}

export async function submitIssueReport(input: DriverIssueReportInput, mobileSession?: MobileDriverSession | null) {
  if (!mobileSession?.session) {
    return { success: false, error: "ยังไม่มี mobile session สำหรับแจ้งปัญหา", statusCode: 401 };
  }

  return requestJson<unknown>("/api/driver/issue", {
    method: "POST",
    headers: { "x-driver-session": mobileSession.session },
    body: JSON.stringify(input)
  });
}
