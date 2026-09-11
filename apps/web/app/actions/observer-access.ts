"use server";

import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { requirePermission } from "@/lib/auth/rbac";
import { generateObserverAccessToken, getDefaultDriverTokenExpiry, hashObserverAccessToken } from "@/lib/driver-access/token";
import { getRequestBaseUrl } from "@/lib/request-origin";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createTimelineEvent, TIMELINE_EVENTS } from "@/lib/timeline";

// Pressing "passenger link" twice used to mint a second live token, and a third,
// with no way to see or revoke the earlier ones — a unit could quietly carry
// several working links. Now that the plaintext is kept (0036), the ordinary
// press *shows* the link that already exists and only an explicit reissue
// replaces it, which is also what an operator means when they press it again.
export async function createObserverAccessTokenAction(input: unknown): Promise<ActionResult> {
  const data = input as { projectId?: string; callSignId?: string; expiresAt?: string | null; reason?: string | null; reissue?: boolean };
  if (!data.projectId || !data.callSignId) return actionFailure("กรุณาเลือกโครงการและ Call Sign");

  const permission = await requirePermission(data.projectId, "assignment.update");
  if (!permission.allowed) return actionFailure(permission.reason || "ไม่มีสิทธิ์สร้างลิงก์ติดตามแบบอ่านอย่างเดียว");

  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ระบบยังไม่พร้อมบันทึกข้อมูล");

  const { data: callSign, error: callSignError } = await client
    .from("call_signs")
    .select("id, call_sign")
    .eq("id", data.callSignId)
    .eq("project_id", data.projectId)
    .maybeSingle();
  if (callSignError) return actionFailure(getDatabaseErrorMessage(callSignError, "ตรวจสอบ Call Sign ไม่สำเร็จ"));
  if (!callSign) return actionFailure("ไม่พบ Call Sign ในโครงการนี้");

  const nowIso = new Date().toISOString();
  const { data: liveTokens } = await client
    .from("observer_access_tokens")
    .select("id, token_plaintext, expires_at")
    .eq("project_id", data.projectId)
    .eq("call_sign_id", data.callSignId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const usable = (liveTokens ?? []).filter(
    (row) => !row.expires_at || String(row.expires_at) > nowIso
  );

  if (!data.reissue) {
    const existing = usable.find((row) => typeof row.token_plaintext === "string" && row.token_plaintext);
    if (existing) {
      return actionSuccess({
        tokenRecord: { id: existing.id, status: "active", expires_at: existing.expires_at },
        reused: true,
        accessUrl: `${await getRequestBaseUrl()}/track/${encodeURIComponent(String(existing.token_plaintext))}`
      });
    }
  }

  // Reissuing, or replacing a pre-0036 token whose plaintext was never kept:
  // either way the older links must stop working, or the unit ends up with
  // several live links and revoking the one on screen changes nothing.
  if (usable.length) {
    await client
      .from("observer_access_tokens")
      .update({ status: "revoked" })
      .in("id", usable.map((row) => row.id));
  }

  const token = generateObserverAccessToken({ callSignId: data.callSignId, expiresAt: data.expiresAt });
  const expiresAt = data.expiresAt || getDefaultDriverTokenExpiry(12);
  const { data: row, error: insertError } = await client
    .from("observer_access_tokens")
    .insert({
      project_id: data.projectId,
      call_sign_id: data.callSignId,
      token_hash: hashObserverAccessToken(token),
      // Kept in the clear so the passenger QR can be drawn again after a reload.
      // The observer link is read-only and carries no PIN; the driver token,
      // which opens a job, stays hash-only. See migration 0036.
      token_plaintext: token,
      status: "active",
      expires_at: expiresAt,
      metadata: { source: "control_room", label: callSign.call_sign, reason: data.reason || null }
    })
    .select("id, status, expires_at")
    .single();

  if (insertError) return actionFailure(getDatabaseErrorMessage(insertError, "สร้างลิงก์ติดตามไม่สำเร็จ"));

  await createTimelineEvent({
    projectId: data.projectId,
    objectType: "call_sign",
    objectId: data.callSignId,
    eventType: TIMELINE_EVENTS.OBSERVER_ACCESS_TOKEN_CREATED,
    source: "operation_user",
    reason: data.reason || "สร้างลิงก์ติดตามแบบอ่านอย่างเดียว",
    afterData: { tokenId: row.id, expiresAt }
  }).catch(() => undefined);

  return actionSuccess({
    tokenRecord: row,
    accessUrl: `${await getRequestBaseUrl()}/track/${encodeURIComponent(token)}`
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
    .select("id, call_sign_id, status")
    .single();

  if (updateError) return actionFailure(getDatabaseErrorMessage(updateError, "ยกเลิกลิงก์ติดตามไม่สำเร็จ"));

  await createTimelineEvent({
    projectId: data.projectId,
    objectType: "call_sign",
    objectId: row.call_sign_id,
    eventType: TIMELINE_EVENTS.OBSERVER_ACCESS_TOKEN_REVOKED,
    source: "operation_user",
    reason: data.reason || "ยกเลิกลิงก์ติดตามแบบอ่านอย่างเดียว",
    afterData: { tokenId: row.id, status: row.status }
  }).catch(() => undefined);

  return actionSuccess({ tokenRecord: row });
}
