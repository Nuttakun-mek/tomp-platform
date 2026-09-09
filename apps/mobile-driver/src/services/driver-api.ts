import type { DriverLocationUpdateInput } from "@tomp/types/schemas";
import { TOMP_API_BASE_URL } from "../config";
import type { MobileDriverAssignment } from "../types";
import type { MobileDriverSession } from "./mobile-session-store";

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(`${TOMP_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const payload = (await response.json().catch(() => null)) as ApiResult<T> | null;
  if (!payload) return { success: false, error: `ไม่สามารถอ่านผลลัพธ์จากระบบได้ (${response.status})` };
  return payload;
}

export async function fetchAssignmentByToken(token: string) {
  return requestJson<MobileDriverAssignment>(`/api/driver/assignment?token=${encodeURIComponent(token)}`);
}

export async function submitLocation(input: DriverLocationUpdateInput, mobileSession?: MobileDriverSession | null) {
  if (!mobileSession?.session) {
    return {
      success: false,
      error: "ยังไม่มี mobile session สำหรับส่งตำแหน่งเบื้องหลัง"
    };
  }

  return requestJson<{ id: string; recordedAt: string }>("/api/driver/location", {
    method: "POST",
    headers: { "x-driver-session": mobileSession.session },
    body: JSON.stringify(input)
  });
}
