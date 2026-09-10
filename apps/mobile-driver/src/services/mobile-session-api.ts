import { TOMP_API_BASE_URL } from "../config";
import type { MobileDriverSession } from "./mobile-session-store";

interface ApiResult<T> {
  success?: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function timeoutSignal(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cancel: () => clearTimeout(timeout) };
}

export async function exchangeMobileSessionChallenge(input: { code: string; installationId: string }): Promise<ApiResult<MobileDriverSession>> {
  const timeout = timeoutSignal();
  try {
    const response = await fetch(`${TOMP_API_BASE_URL}/api/driver/mobile-session/exchange`, {
      method: "POST",
      signal: timeout.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    const payload = (await response.json().catch(() => null)) as ApiResult<MobileDriverSession> | null;
    if (!payload) return { success: false, error: `อ่านผลลัพธ์ mobile session ไม่สำเร็จ (${response.status})`, statusCode: response.status };
    if (!response.ok && payload.success !== false) {
      return { success: false, error: payload.error ?? `สร้าง mobile session ไม่สำเร็จ (${response.status})`, statusCode: response.status };
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
