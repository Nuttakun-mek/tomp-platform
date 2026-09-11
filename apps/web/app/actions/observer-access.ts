"use server";

import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { requirePermission } from "@/lib/auth/rbac";
import {
  generateObserverAccessToken,
  generateObserverPin,
  getDefaultDriverTokenExpiry,
  hashObserverAccessToken,
  hashObserverPin
} from "@/lib/driver-access/token";
import { getRequestBaseUrl } from "@/lib/request-origin";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createTimelineEvent, TIMELINE_EVENTS } from "@/lib/timeline";

type ObserverScope = "call_sign" | "project";
type WriteClient = NonNullable<ReturnType<typeof getSupabaseWriteClient>["client"]>;

interface CreateObserverInput {
  projectId?: string;
  callSignId?: string | null;
  scope?: ObserverScope;
  callSignIds?: string[];
  expiresAt?: string | null;
  reason?: string | null;
  reissue?: boolean;
  withPin?: boolean;
  showCrew?: boolean;
  label?: string | null;
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function defaultProjectExpiry(endDate: string | null | undefined) {
  if (endDate) {
    const value = new Date(endDate);
    if (!Number.isNaN(value.getTime())) {
      value.setDate(value.getDate() + 1);
      return value.toISOString();
    }
  }
  return getDefaultDriverTokenExpiry(24 * 30);
}

async function verifyProjectAndOptionalCallSign(client: WriteClient, input: CreateObserverInput, scope: ObserverScope) {
  const { data: project, error: projectError } = await client
    .from("projects")
    .select("id, project_code, project_name, end_date")
    .eq("id", input.projectId)
    .maybeSingle();
  if (projectError) return { error: getDatabaseErrorMessage(projectError, "ตรวจสอบโครงการไม่สำเร็จ") };
  if (!project) return { error: "ไม่พบโครงการนี้" };

  if (scope === "call_sign") {
    const { data: callSign, error: callSignError } = await client
      .from("call_signs")
      .select("id, call_sign")
      .eq("id", input.callSignId)
      .eq("project_id", input.projectId)
      .maybeSingle();
    if (callSignError) return { error: getDatabaseErrorMessage(callSignError, "ตรวจสอบ Call Sign ไม่สำเร็จ") };
    if (!callSign) return { error: "ไม่พบ Call Sign ในโครงการนี้" };
    return { project, callSign };
  }

  return { project, callSign: null };
}

function liveTokenQuery(client: WriteClient, projectId: string, scope: ObserverScope, callSignId: string | null) {
  let query = client
    .from("observer_access_tokens")
    .select("id, token_plaintext, expires_at, pin_hash")
    .eq("project_id", projectId)
    .eq("scope", scope)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  query = scope === "call_sign" ? query.eq("call_sign_id", callSignId) : query.is("call_sign_id", null);
  return query;
}

export async function createObserverAccessTokenAction(input: unknown): Promise<ActionResult> {
  const data = input as CreateObserverInput;
  const scope: ObserverScope = data.scope === "project" ? "project" : "call_sign";
  const projectId = cleanString(data.projectId);
  const callSignId = cleanString(data.callSignId);

  if (!projectId) return actionFailure("กรุณาเลือกโครงการ");
  if (scope === "call_sign" && !callSignId) return actionFailure("กรุณาเลือก Call Sign");

  const permission = await requirePermission(projectId, "assignment.update");
  if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์สร้างลิงก์ติดตาม");

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ระบบยังไม่พร้อมบันทึกข้อมูล");

  const verified = await verifyProjectAndOptionalCallSign(client, { ...data, projectId, callSignId }, scope);
  if (verified.error) return actionFailure(verified.error);

  const nowIso = new Date().toISOString();
  const { data: liveTokens } = await liveTokenQuery(client, projectId, scope, callSignId);
  const usable = (liveTokens ?? []).filter((row) => !row.expires_at || String(row.expires_at) > nowIso);

  // Only an explicit reissue may replace a live link. Keying this off withPin as
  // well meant an operator who had ticked "use a PIN" silently minted a new token
  // — and revoked the one already printed — every time they pressed the ordinary
  // button to look at the link again. Changing the PIN or the scope is what
  // "ออกลิงก์ใหม่" is for, and it says so.
  if (!data.reissue) {
    const existing = usable.find((row) => typeof row.token_plaintext === "string" && row.token_plaintext);
    if (existing) {
      const accessPath = scope === "project" ? "fleet" : "track";
      return actionSuccess({
        tokenRecord: { id: existing.id, status: "active", expires_at: existing.expires_at, hasPin: Boolean(existing.pin_hash) },
        reused: true,
        accessUrl: `${await getRequestBaseUrl()}/${accessPath}/${encodeURIComponent(String(existing.token_plaintext))}`
      });
    }
  }

  if (usable.length) {
    await client
      .from("observer_access_tokens")
      .update({ status: "revoked", metadata: { revokedReason: "superseded_by_newer_observer_link" } })
      .in("id", usable.map((row) => row.id));
  }

  const expiresAt = data.expiresAt || (scope === "project" ? defaultProjectExpiry(cleanString(verified.project?.end_date)) : getDefaultDriverTokenExpiry(12));
  const token = generateObserverAccessToken({ scope, projectId, callSignId, expiresAt });
  const pin = data.withPin ? generateObserverPin() : null;
  const label = cleanString(data.label) ?? (scope === "project" ? cleanString(verified.project?.project_name) : cleanString(verified.callSign?.call_sign));
  const subset = scope === "project" && Array.isArray(data.callSignIds) && data.callSignIds.length ? data.callSignIds.filter(Boolean) : null;

  const { data: row, error: insertError } = await client
    .from("observer_access_tokens")
    .insert({
      project_id: projectId,
      call_sign_id: scope === "call_sign" ? callSignId : null,
      scope,
      call_sign_ids: subset,
      show_crew: Boolean(data.showCrew),
      label,
      pin_hash: pin ? hashObserverPin(pin) : null,
      token_hash: hashObserverAccessToken(token),
      token_plaintext: token,
      status: "active",
      expires_at: expiresAt,
      metadata: { source: "control_room", label, reason: data.reason || null, scope }
    })
    .select("id, status, expires_at")
    .single();

  if (insertError) return actionFailure(getDatabaseErrorMessage(insertError, "สร้างลิงก์ติดตามไม่สำเร็จ"));

  await createTimelineEvent({
    projectId,
    objectType: scope === "project" ? "project" : "call_sign",
    objectId: scope === "project" ? projectId : callSignId,
    eventType: TIMELINE_EVENTS.OBSERVER_ACCESS_TOKEN_CREATED,
    source: "operation_user",
    reason: data.reason || (scope === "project" ? "สร้างลิงก์ติดตามระดับโครงการ" : "สร้างลิงก์ติดตามแบบอ่านอย่างเดียว"),
    afterData: { tokenId: row.id, expiresAt, scope, hasPin: Boolean(pin), showCrew: Boolean(data.showCrew), callSignIds: subset }
  }).catch(() => undefined);

  const accessPath = scope === "project" ? "fleet" : "track";
  return actionSuccess({
    tokenRecord: row,
    accessUrl: `${await getRequestBaseUrl()}/${accessPath}/${encodeURIComponent(token)}`,
    pin
  });
}

export async function revokeObserverAccessTokenAction(input: unknown): Promise<ActionResult> {
  const data = input as { projectId?: string; tokenId?: string; reason?: string | null };
  if (!data.projectId || !data.tokenId) return actionFailure("กรุณาเลือกลิงก์ติดตามที่ต้องการยกเลิก");

  const permission = await requirePermission(data.projectId, "assignment.update");
  if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์ยกเลิกลิงก์ติดตาม");

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ระบบยังไม่พร้อมบันทึกข้อมูล");

  const { data: row, error: updateError } = await client
    .from("observer_access_tokens")
    .update({ status: "revoked", metadata: { revokedReason: data.reason || "ยกเลิกโดยศูนย์ควบคุม" } })
    .eq("id", data.tokenId)
    .eq("project_id", data.projectId)
    .select("id, call_sign_id, scope, status")
    .single();

  if (updateError) return actionFailure(getDatabaseErrorMessage(updateError, "ยกเลิกลิงก์ติดตามไม่สำเร็จ"));

  await createTimelineEvent({
    projectId: data.projectId,
    objectType: row.scope === "project" ? "project" : "call_sign",
    objectId: row.scope === "project" ? data.projectId : row.call_sign_id,
    eventType: TIMELINE_EVENTS.OBSERVER_ACCESS_TOKEN_REVOKED,
    source: "operation_user",
    reason: data.reason || "ยกเลิกลิงก์ติดตามแบบอ่านอย่างเดียว",
    afterData: { tokenId: row.id, status: row.status, scope: row.scope }
  }).catch(() => undefined);

  return actionSuccess({ tokenRecord: row });
}
