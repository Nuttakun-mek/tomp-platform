import type { DriverAssignmentPacket, DriverEvidencePhoto, DriverIssueReport } from "@tomp/types/domain";
import type { AssignmentStatusUpdateInput, DriverCheckinInput } from "@tomp/types/schemas";

export interface DriverApiConfig {
  baseUrl: string;
  fetcher?: typeof fetch;
}

export interface DriverApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function requestJson<T>(config: DriverApiConfig, path: string, init?: RequestInit): Promise<DriverApiResult<T>> {
  const fetcher = config.fetcher ?? fetch;
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const response = await fetcher(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const payload = (await response.json().catch(() => null)) as DriverApiResult<T> | null;
  if (!payload) return { success: false, error: `Request failed with HTTP ${response.status}` };
  if (!response.ok && payload.success !== false) return { success: false, error: payload.error ?? `Request failed with HTTP ${response.status}` };
  return payload;
}

export async function fetchDriverAssignmentByToken(token: string, config?: DriverApiConfig): Promise<DriverAssignmentPacket> {
  if (!config?.baseUrl) {
    throw new Error("Driver API baseUrl is required.");
  }
  const result = await requestJson<{ packet: DriverAssignmentPacket }>(config, `/api/driver/assignment?token=${encodeURIComponent(token)}`);
  if (!result.success || !result.data?.packet) throw new Error(result.error ?? "Driver assignment was not found.");
  return result.data.packet;
}

export async function submitDriverReadiness(input: DriverCheckinInput, config?: DriverApiConfig): Promise<DriverApiResult<unknown>> {
  if (!config?.baseUrl) return { success: false, error: "Driver API baseUrl is required." };
  return requestJson(config, "/api/driver/readiness", { method: "POST", body: JSON.stringify(input) });
}

export async function submitDriverStatusUpdate(input: AssignmentStatusUpdateInput, config?: DriverApiConfig): Promise<DriverApiResult<unknown>> {
  if (!config?.baseUrl) return { success: false, error: "Driver API baseUrl is required." };
  return requestJson(config, "/api/driver/status", { method: "POST", body: JSON.stringify(input) });
}

export async function submitDriverIssueReport(input: DriverIssueReport, config?: DriverApiConfig): Promise<DriverApiResult<unknown>> {
  if (!config?.baseUrl) return { success: false, error: "Driver API baseUrl is required." };
  return requestJson(config, "/api/driver/issue", { method: "POST", body: JSON.stringify(input) });
}

export async function submitDriverPhotoEvidence(_input: DriverEvidencePhoto, _config?: DriverApiConfig): Promise<DriverApiResult<unknown>> {
  return { success: false, error: "Photo evidence upload is prepared but not enabled in the mobile MVP." };
}
