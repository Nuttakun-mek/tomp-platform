import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { getPostgresClient } from "@/lib/db/postgres";
import { type DriverSessionContext } from "@/lib/api/driver-token";
import { DRIVER_SESSION_MAX_AGE, mintDriverSession } from "@/lib/driver-access/session";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

const CHALLENGE_TTL_SECONDS = 60;
const MOBILE_SESSION_TOUCH_THROTTLE_SECONDS = 120;

function hashValue(value: string) {
  return createHash("sha256").update(`tomp-mobile-session:${value}`).digest("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function expiresIn(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export function createMobileSessionChallengeCode() {
  return randomBytes(24).toString("base64url");
}

export async function createMobileSessionChallenge(ctx: DriverSessionContext) {
  const code = createMobileSessionChallengeCode();
  const challengeHash = hashValue(code);
  const challengeExpiresAt = expiresIn(CHALLENGE_TTL_SECONDS);

  const row = {
    token_id: ctx.tokenId,
    project_id: ctx.projectId,
    assignment_id: ctx.assignmentId,
    call_sign_id: ctx.callSignId || null,
    driver_id: ctx.driverId,
    device_hash: ctx.deviceHash,
    challenge_hash: challengeHash,
    status: "challenge_issued",
    challenge_expires_at: challengeExpiresAt,
    metadata: { source: "driver_webview" }
  };

  const { client } = getSupabaseWriteClient();
  if (client) {
    const { error } = await client.from("driver_mobile_sessions").insert(row);
    if (error) throw new Error(error.message);
    return { code, expiresAt: challengeExpiresAt };
  }

  const sql = getPostgresClient();
  if (!sql) throw new Error("ยังไม่ได้ตั้งค่าฐานข้อมูลสำหรับ mobile session");
  await sql`
    insert into driver_mobile_sessions (
      token_id, project_id, assignment_id, call_sign_id, driver_id, device_hash,
      challenge_hash, status, challenge_expires_at, metadata
    ) values (
      ${row.token_id}, ${row.project_id}, ${row.assignment_id}, ${row.call_sign_id}, ${row.driver_id}, ${row.device_hash},
      ${row.challenge_hash}, ${row.status}, ${row.challenge_expires_at}, ${JSON.stringify(row.metadata)}::jsonb
    )
  `;

  return { code, expiresAt: challengeExpiresAt };
}

export async function exchangeMobileSessionChallenge(input: { code: string; installationId: string }) {
  const challengeHash = hashValue(input.code);
  const installationIdHash = hashValue(input.installationId);
  const issuedAt = nowIso();
  const expiresAt = expiresIn(DRIVER_SESSION_MAX_AGE);

  const { client } = getSupabaseWriteClient();
  if (client) {
    const { data: sessionRow, error } = await client
      .from("driver_mobile_sessions")
      .select("id, token_id, project_id, assignment_id, call_sign_id, driver_id, device_hash, challenge_expires_at, status")
      .eq("challenge_hash", challengeHash)
      .eq("status", "challenge_issued")
      .gt("challenge_expires_at", issuedAt)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!sessionRow) return null;

    const session = mintDriverSession({
      tid: String(sessionRow.token_id),
      pid: String(sessionRow.project_id),
      aid: sessionRow.assignment_id ? String(sessionRow.assignment_id) : null,
      csid: sessionRow.call_sign_id ? String(sessionRow.call_sign_id) : null,
      did: String(sessionRow.driver_id),
      dev: String(sessionRow.device_hash)
    });
    const { data: updatedSessionRow, error: updateError } = await client
      .from("driver_mobile_sessions")
      .update({
        status: "active",
        installation_id_hash: installationIdHash,
        session_hash: hashValue(session),
        issued_at: issuedAt,
        exchanged_at: issuedAt,
        expires_at: expiresAt,
        updated_at: issuedAt
      })
      .eq("id", sessionRow.id)
      .eq("status", "challenge_issued")
      .select("id")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!updatedSessionRow) return null;
    return { session, expiresAt };
  }

  const sql = getPostgresClient();
  if (!sql) throw new Error("ยังไม่ได้ตั้งค่าฐานข้อมูลสำหรับ mobile session");
  const rows = await sql<Array<{ id: string; token_id: string; project_id: string; assignment_id: string | null; call_sign_id: string | null; driver_id: string; device_hash: string }>>`
    select id, token_id, project_id, assignment_id, call_sign_id, driver_id, device_hash
    from driver_mobile_sessions
    where challenge_hash = ${challengeHash}
      and status = 'challenge_issued'
      and challenge_expires_at > ${issuedAt}
    limit 1
  `;
  const sessionRow = rows[0];
  if (!sessionRow) return null;

  const session = mintDriverSession({
    tid: sessionRow.token_id,
    pid: sessionRow.project_id,
    aid: sessionRow.assignment_id,
    csid: sessionRow.call_sign_id,
    did: sessionRow.driver_id,
    dev: sessionRow.device_hash
  });

  const updated = await sql<Array<{ id: string }>>`
    update driver_mobile_sessions
    set status = 'active',
        installation_id_hash = ${installationIdHash},
        session_hash = ${hashValue(session)},
        issued_at = ${issuedAt},
        exchanged_at = ${issuedAt},
        expires_at = ${expiresAt},
        updated_at = ${issuedAt}
    where id = ${sessionRow.id}
      and status = 'challenge_issued'
      and challenge_expires_at > ${issuedAt}
    returning id
  `;
  if (updated.length === 0) return null;

  return { session, expiresAt };
}

function shouldTouchMobileSession(lastUsedAt: string | null | undefined, nowMs = Date.now()) {
  if (!lastUsedAt) return true;
  const lastUsedMs = Date.parse(lastUsedAt);
  if (!Number.isFinite(lastUsedMs)) return true;
  return nowMs - lastUsedMs >= MOBILE_SESSION_TOUCH_THROTTLE_SECONDS * 1000;
}

export async function markMobileSessionUsed(session: string): Promise<"active" | "inactive" | "unknown"> {
  const sessionHash = hashValue(session);
  const usedAt = nowIso();

  const { client } = getSupabaseWriteClient();
  if (client) {
    const { data, error } = await client
      .from("driver_mobile_sessions")
      .select("id, last_used_at")
      .eq("session_hash", sessionHash)
      .eq("status", "active")
      .gt("expires_at", usedAt)
      .is("revoked_at", null)
      .maybeSingle();
    if (error) return "unknown";
    if (!data) return "inactive";
    if (!shouldTouchMobileSession(data.last_used_at)) return "active";

    const { error: touchError } = await client
      .from("driver_mobile_sessions")
      .update({ last_used_at: usedAt, updated_at: usedAt })
      .eq("id", data.id);
    return touchError ? "unknown" : "active";
  }

  const sql = getPostgresClient();
  if (!sql) return "unknown";
  try {
    const rows = await sql<Array<{ id: string; last_used_at: string | null }>>`
      select id, last_used_at
      from driver_mobile_sessions
      where session_hash = ${sessionHash}
        and status = 'active'
        and expires_at > ${usedAt}
        and revoked_at is null
      limit 1
    `;
    const row = rows[0];
    if (!row) return "inactive";
    if (!shouldTouchMobileSession(row.last_used_at)) return "active";

    await sql`
      update driver_mobile_sessions
      set last_used_at = ${usedAt},
          updated_at = ${usedAt}
      where id = ${row.id}
    `;
    return "active";
  } catch {
    return "unknown";
  }
}

/**
 * Store the device's Expo push token on the active mobile session. Kept in
 * metadata rather than a new column so this needs no migration; dispatch reads
 * it back by assignment when it has something to tell the driver.
 */
export async function saveMobileSessionPushToken(
  ctx: DriverSessionContext,
  pushToken: string,
  platform: string
): Promise<boolean> {
  const updatedAt = nowIso();
  const { client } = getSupabaseWriteClient();
  if (client) {
    const { data, error } = await client
      .from("driver_mobile_sessions")
      .select("id, metadata")
      .eq("token_id", ctx.tokenId)
      .eq(ctx.callSignId ? "call_sign_id" : "assignment_id", ctx.callSignId || ctx.assignmentId)
      .eq("status", "active")
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return false;

    const metadata = { ...((data.metadata as Record<string, unknown>) ?? {}), pushToken, pushPlatform: platform, pushTokenAt: updatedAt };
    const { error: updateError } = await client
      .from("driver_mobile_sessions")
      .update({ metadata, updated_at: updatedAt })
      .eq("id", data.id);
    return !updateError;
  }

  const sql = getPostgresClient();
  if (!sql) return false;
  try {
    const rows = await sql<Array<{ id: string }>>`
      update driver_mobile_sessions
      set metadata = coalesce(metadata, '{}'::jsonb) || ${sql.json({ pushToken, pushPlatform: platform, pushTokenAt: updatedAt })}::jsonb,
          updated_at = ${updatedAt}
      where id = (
        select id from driver_mobile_sessions
        where token_id = ${ctx.tokenId}
          and (assignment_id = ${ctx.assignmentId} or call_sign_id = ${ctx.callSignId || ""})
          and status = 'active' and revoked_at is null
        order by created_at desc limit 1
      )
      returning id
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}
