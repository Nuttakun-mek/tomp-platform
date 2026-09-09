import { TOMP_API_BASE_URL } from "../config";
import type { MobileDriverSession } from "./mobile-session-store";

interface ApiResult<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

export async function exchangeMobileSessionChallenge(input: { code: string; installationId: string }): Promise<ApiResult<MobileDriverSession>> {
  const response = await fetch(`${TOMP_API_BASE_URL}/api/driver/mobile-session/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  const payload = (await response.json().catch(() => null)) as ApiResult<MobileDriverSession> | null;
  if (!payload) return { success: false, error: `อ่านผลลัพธ์ mobile session ไม่สำเร็จ (${response.status})` };
  return payload;
}
