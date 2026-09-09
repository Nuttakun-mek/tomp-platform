import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { getPostgresClient } from "@/lib/db/postgres";
import { type DriverSessionContext } from "@/lib/api/driver-token";
import { DRIVER_SESSION_MAX_AGE, mintDriverSession } from "@/lib/driver-access/session";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

const CHALLENGE_TTL_SECONDS = 60;

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
      token_id, project_id, assignment_id, driver_id, device_hash,
      challenge_hash, status, challenge_expires_at, metadata
    ) values (
      ${row.token_id}, ${row.project_id}, ${row.assignment_id}, ${row.driver_id}, ${row.device_hash},
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
      .select("id, token_id, project_id, assignment_id, driver_id, device_hash, challenge_expires_at, status")
      .eq("challenge_hash", challengeHash)
      .eq("status", "challenge_issued")
      .gt("challenge_expires_at", issuedAt)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!sessionRow) return null;

    const session = mintDriverSession({
      tid: String(sessionRow.token_id),
      pid: String(sessionRow.project_id),
      aid: String(sessionRow.assignment_id),
      did: String(sessionRow.driver_id),
      dev: String(sessionRow.device_hash)
    });
    const { error: updateError } = await client
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
      .eq("id", sessionRow.id);
    if (updateError) throw new Error(updateError.message);
    return { session, expiresAt };
  }

  const sql = getPostgresClient();
  if (!sql) throw new Error("ยังไม่ได้ตั้งค่าฐานข้อมูลสำหรับ mobile session");
  const rows = await sql<Array<{ id: string; token_id: string; project_id: string; assignment_id: string; driver_id: string; device_hash: string }>>`
    select id, token_id, project_id, assignment_id, driver_id, device_hash
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
    did: sessionRow.driver_id,
    dev: sessionRow.device_hash
  });

  await sql`
    update driver_mobile_sessions
    set status = 'active',
        installation_id_hash = ${installationIdHash},
        session_hash = ${hashValue(session)},
        issued_at = ${issuedAt},
        exchanged_at = ${issuedAt},
        expires_at = ${expiresAt},
        updated_at = ${issuedAt}
    where id = ${sessionRow.id}
  `;

  return { session, expiresAt };
}

export async function markMobileSessionUsed(session: string) {
  const sessionHash = hashValue(session);
  const usedAt = nowIso();

  const { client } = getSupabaseWriteClient();
  if (client) {
    const { data, error } = await client
      .from("driver_mobile_sessions")
      .update({ last_used_at: usedAt, updated_at: usedAt })
      .eq("session_hash", sessionHash)
      .eq("status", "active")
      .gt("expires_at", usedAt)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (error) return false;
    return Boolean(data);
  }

  const sql = getPostgresClient();
  if (!sql) return false;
  const rows = await sql<Array<{ id: string }>>`
    update driver_mobile_sessions
    set last_used_at = ${usedAt},
        updated_at = ${usedAt}
    where session_hash = ${sessionHash}
      and status = 'active'
      and expires_at > ${usedAt}
      and revoked_at is null
    returning id
  `;
  return rows.length > 0;
}
