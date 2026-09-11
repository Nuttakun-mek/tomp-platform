import "server-only";

import { hashObserverAccessToken } from "@/lib/driver-access/token";
import { getPostgresClient } from "@/lib/db/postgres";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

type Row = Record<string, unknown>;

function text(row: Row | null | undefined, key: string, fallback = "") {
  return typeof row?.[key] === "string" ? row[key] : fallback;
}

function numberValue(row: Row | null | undefined, key: string) {
  const value = row?.[key];
  return typeof value === "number" ? value : typeof value === "string" ? Number(value) : null;
}

export interface ObserverAccessView {
  project: { id: string; name: string; code: string; status: string };
  callSign: { id: string; label: string };
  assignment: { id: string; status: string; pickup: string; dropoff: string; startTime: string | null; endTime: string | null } | null;
  vehicle: { id: string; plateNumber: string; vehicleType: string } | null;
  location: { latitude: number | null; longitude: number | null; recordedAt: string | null; status: string } | null;
}

function routeMeta(row: Row | null | undefined, key: string, fallback: string) {
  const meta = row?.metadata && typeof row.metadata === "object" ? row.metadata as Row : {};
  return text(meta, key) || text(meta, key.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`), fallback);
}

export async function getObserverAccessView(token: string): Promise<ObserverAccessView | null> {
  if (!token.startsWith("tomp_obs_")) return null;
  const tokenHash = hashObserverAccessToken(token);

  const { client } = getSupabaseWriteClient();
  if (client) {
    const { data: tokenRow } = await client
      .from("observer_access_tokens")
      .select("id, project_id, call_sign_id, status, expires_at, usage_count")
      .eq("token_hash", tokenHash)
      .eq("status", "active")
      .maybeSingle();
    if (!tokenRow || (tokenRow.expires_at && new Date(String(tokenRow.expires_at)).getTime() <= Date.now())) return getObserverAccessViewViaPostgres(tokenHash);

    await client
      .from("observer_access_tokens")
      .update({ last_used_at: new Date().toISOString(), usage_count: Number(tokenRow.usage_count ?? 0) + 1 })
      .eq("id", tokenRow.id);

    const [{ data: project }, { data: callSign }, { data: assignment }, { data: location }] = await Promise.all([
      client.from("projects").select("id, project_code, project_name, status").eq("id", tokenRow.project_id).maybeSingle(),
      client.from("call_signs").select("id, call_sign, vehicle_id").eq("id", tokenRow.call_sign_id).maybeSingle(),
      client
        .from("assignments")
        .select("id, status, start_time, end_time, vehicle_id, metadata")
        .eq("project_id", tokenRow.project_id)
        .eq("call_sign_id", tokenRow.call_sign_id)
        .neq("status", "cancelled")
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle(),
      client
        .from("gps_locations")
        .select("latitude, longitude, recorded_at, sharing_event")
        .eq("project_id", tokenRow.project_id)
        .eq("call_sign_id", tokenRow.call_sign_id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

    if (!project || !callSign) return getObserverAccessViewViaPostgres(tokenHash);
    const vehicleId = text(assignment as Row | null, "vehicle_id") || text(callSign as Row, "vehicle_id");
    const { data: vehicle } = vehicleId
      ? await client.from("vehicles").select("id, plate_number, vehicle_type").eq("id", vehicleId).maybeSingle()
      : { data: null };

    return buildObserverView(project as Row, callSign as Row, assignment as Row | null, vehicle as Row | null, location as Row | null);
  }

  return getObserverAccessViewViaPostgres(tokenHash);
}

async function getObserverAccessViewViaPostgres(tokenHash: string): Promise<ObserverAccessView | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const tokenRows = await sql<Row[]>`
    select id, project_id, call_sign_id, expires_at
    from observer_access_tokens
    where token_hash = ${tokenHash}
      and status = 'active'
    limit 1
  `;
  const tokenRow = tokenRows[0];
  if (!tokenRow || (tokenRow.expires_at && new Date(String(tokenRow.expires_at)).getTime() <= Date.now())) return null;

  await sql`
    update observer_access_tokens
    set last_used_at = now(), usage_count = coalesce(usage_count, 0) + 1
    where id = ${String(tokenRow.id)}
  `.catch(() => undefined);

  const [projectRows, callSignRows, assignmentRows, locationRows] = await Promise.all([
    sql<Row[]>`select id, project_code, project_name, status from projects where id = ${String(tokenRow.project_id)} limit 1`,
    sql<Row[]>`select id, call_sign, vehicle_id from call_signs where id = ${String(tokenRow.call_sign_id)} limit 1`,
    sql<Row[]>`
      select id, status, start_time, end_time, vehicle_id, metadata
      from assignments
      where project_id = ${String(tokenRow.project_id)}
        and call_sign_id = ${String(tokenRow.call_sign_id)}
        and status <> 'cancelled'
      order by start_time asc nulls last, created_at asc
      limit 1
    `,
    sql<Row[]>`
      select latitude, longitude, recorded_at, sharing_event
      from gps_locations
      where project_id = ${String(tokenRow.project_id)}
        and call_sign_id = ${String(tokenRow.call_sign_id)}
      order by recorded_at desc nulls last, created_at desc
      limit 1
    `
  ]);
  const project = projectRows[0];
  const callSign = callSignRows[0];
  if (!project || !callSign) return null;
  const vehicleId = text(assignmentRows[0], "vehicle_id") || text(callSign, "vehicle_id");
  const vehicleRows = vehicleId ? await sql<Row[]>`select id, plate_number, vehicle_type from vehicles where id = ${vehicleId} limit 1` : [];
  return buildObserverView(project, callSign, assignmentRows[0] || null, vehicleRows[0] || null, locationRows[0] || null);
}

function buildObserverView(project: Row, callSign: Row, assignment: Row | null, vehicle: Row | null, location: Row | null): ObserverAccessView {
  return {
    project: {
      id: text(project, "id"),
      code: text(project, "project_code"),
      name: text(project, "project_name", "ยังไม่ระบุโครงการ"),
      status: text(project, "status", "planning")
    },
    callSign: {
      id: text(callSign, "id"),
      label: text(callSign, "call_sign", "ยังไม่ระบุ")
    },
    assignment: assignment
      ? {
          id: text(assignment, "id"),
          status: text(assignment, "status", "planned"),
          pickup: routeMeta(assignment, "pickupLocation", "ยังไม่ระบุจุดรับ"),
          dropoff: routeMeta(assignment, "dropoffLocation", "ยังไม่ระบุจุดส่ง"),
          startTime: text(assignment, "start_time") || null,
          endTime: text(assignment, "end_time") || null
        }
      : null,
    vehicle: vehicle
      ? {
          id: text(vehicle, "id"),
          plateNumber: text(vehicle, "plate_number", "ยังไม่ระบุทะเบียน"),
          vehicleType: text(vehicle, "vehicle_type", "ยังไม่ระบุประเภทรถ")
        }
      : null,
    location: location
      ? {
          latitude: numberValue(location, "latitude"),
          longitude: numberValue(location, "longitude"),
          recordedAt: text(location, "recorded_at") || null,
          status: text(location, "sharing_event", "location_ping")
        }
      : null
  };
}

/**
 * The live passenger link for each unit in a project, keyed by call sign.
 *
 * This is what makes the QR redrawable. It is read on the server and handed to
 * the unit card, so the passenger QR is on screen the moment the page loads
 * rather than only in the tab that happened to issue it.
 *
 * Units issued before migration 0036 are absent: their plaintext was never
 * stored, so there is nothing to return and the card offers a reissue instead.
 */
export async function getObserverLinksByProjectId(projectId: string): Promise<Record<string, string>> {
  if (!projectId) return {};
  const nowIso = new Date().toISOString();
  const links: Record<string, string> = {};

  const { client } = getSupabaseWriteClient();
  if (client) {
    const { data } = await client
      .from("observer_access_tokens")
      .select("call_sign_id, token_plaintext, expires_at")
      .eq("project_id", projectId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    for (const row of data ?? []) {
      const callSignId = typeof row.call_sign_id === "string" ? row.call_sign_id : "";
      const plain = typeof row.token_plaintext === "string" ? row.token_plaintext : "";
      if (!callSignId || !plain || links[callSignId]) continue;
      if (row.expires_at && String(row.expires_at) <= nowIso) continue;
      links[callSignId] = plain;
    }
    return links;
  }

  const sql = getPostgresClient();
  if (!sql) return links;
  try {
    const rows = await sql<Array<{ call_sign_id: string; token_plaintext: string | null; expires_at: string | null }>>`
      select call_sign_id, token_plaintext, expires_at
      from observer_access_tokens
      where project_id = ${projectId} and status = 'active'
      order by created_at desc
    `;
    for (const row of rows) {
      if (!row.token_plaintext || links[row.call_sign_id]) continue;
      if (row.expires_at && String(row.expires_at) <= nowIso) continue;
      links[row.call_sign_id] = row.token_plaintext;
    }
  } catch {
    // A card with no link offers to issue one, which is the safe default.
  }
  return links;
}
