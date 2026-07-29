import type { AssignmentStatusUpdateInput, DriverCheckinInput, DriverIssueReportInput, DriverLocationUpdateInput } from "@tomp/types/schemas";
import { TOMP_API_BASE_URL } from "../config";
import type { MobileDriverAssignment } from "../types";

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

export async function submitReadiness(input: DriverCheckinInput) {
  return requestJson<unknown>("/api/driver/readiness", { method: "POST", body: JSON.stringify(input) });
}

export async function submitStatus(input: AssignmentStatusUpdateInput) {
  return requestJson<unknown>("/api/driver/status", { method: "POST", body: JSON.stringify(input) });
}

export async function submitIssue(input: DriverIssueReportInput) {
  return requestJson<unknown>("/api/driver/issue", { method: "POST", body: JSON.stringify(input) });
}

export async function submitLocation(input: DriverLocationUpdateInput) {
  return requestJson<{ id: string; recordedAt: string }>("/api/driver/location", { method: "POST", body: JSON.stringify(input) });
}
