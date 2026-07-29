import { NextResponse } from "next/server";
import { driverLocationUpdateSchema } from "@tomp/types/schemas";
import { hashDriverAccessToken } from "@/lib/driver-access/token";
import { getPostgresClient } from "@/lib/db/postgres";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createTimelineEvent, TIMELINE_EVENTS } from "@/lib/timeline";

type LocationInput = typeof driverLocationUpdateSchema._type;
type TokenRow = {
  project_id: string;
  assignment_id: string;
  driver_id: string | null;
  expires_at: string | null;
};

async function updateLocationSession(input: {
  client: NonNullable<ReturnType<typeof getSupabaseWriteClient>["client"]>;
  projectId: string;
  assignmentId: string;
  driverId: string | null;
  vehicleId: string | null;
  recordedAt: string;
  trackingEvent: "sharing_started" | "location_ping" | "sharing_stopped";
}) {
  if (input.trackingEvent === "sharing_started") {
    await input.client.from("driver_location_sessions").insert({
      project_id: input.projectId,
      assignment_id: input.assignmentId,
      driver_id: input.driverId,
      vehicle_id: input.vehicleId,
      started_at: input.recordedAt,
      consent_given_at: input.recordedAt,
      status: "healthy",
      last_ping_at: input.recordedAt,
      metadata: { source: "web_driver" }
    });
    return;
  }

  const { data: session } = await input.client
    .from("driver_location_sessions")
    .select("id")
    .eq("assignment_id", input.assignmentId)
    .is("stopped_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (session?.id) {
    await input.client
      .from("driver_location_sessions")
      .update({
        status: input.trackingEvent === "sharing_stopped" ? "offline" : "healthy",
        last_ping_at: input.recordedAt,
        stopped_at: input.trackingEvent === "sharing_stopped" ? input.recordedAt : null
      })
      .eq("id", session.id);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = driverLocationUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "ข้อมูลตำแหน่งไม่ถูกต้อง",
        fieldErrors: parsed.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  const { client, error } = getSupabaseWriteClient();
  if (!client) {
    return writeDriverLocationViaPostgres(parsed.data, request, error || "ยังไม่ได้ตั้งค่า Supabase สำหรับรับตำแหน่ง");
  }

  try {
    return await writeDriverLocationViaSupabase(client, parsed.data, request);
  } catch (supabaseError) {
    return writeDriverLocationViaPostgres(
      parsed.data,
      request,
      supabaseError instanceof Error ? supabaseError.message : "เชื่อมต่อ Supabase ไม่สำเร็จ"
    );
  }
}

async function writeDriverLocationViaSupabase(client: NonNullable<ReturnType<typeof getSupabaseWriteClient>["client"]>, input: LocationInput, request: Request) {
  const tokenHash = hashDriverAccessToken(input.token);
  const { data: tokenRow, error: tokenError } = await client
    .from("driver_access_tokens")
    .select("project_id, assignment_id, driver_id, status, expires_at")
    .eq("token_hash", tokenHash)
    .eq("status", "active")
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return writeDriverLocationViaPostgres(input, request, "QR หรือ token ไม่ถูกต้อง กรุณาขอ QR ใหม่จากศูนย์ควบคุม");
  }

  if (tokenRow.expires_at && new Date(String(tokenRow.expires_at)).getTime() <= Date.now()) {
    return NextResponse.json({ success: false, error: "QR หมดอายุแล้ว กรุณาขอ QR ใหม่จากศูนย์ควบคุม" }, { status: 403 });
  }

  const { data: assignment } = await client.from("assignments").select("vehicle_id").eq("id", tokenRow.assignment_id).maybeSingle();
  const vehicleId = typeof assignment?.vehicle_id === "string" ? assignment.vehicle_id : null;
  const recordedAt = input.recordedAt || new Date().toISOString();

  const { data: inserted, error: insertError } = await client
    .from("gps_locations")
    .insert({
      project_id: tokenRow.project_id,
      assignment_id: tokenRow.assignment_id,
      driver_id: tokenRow.driver_id,
      vehicle_id: vehicleId,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy ?? null,
      recorded_at: recordedAt,
      source: "driver_web_app",
      sharing_event: input.trackingEvent,
      metadata: {
        ...input.metadata,
        pilot: true,
        userAgent: request.headers.get("user-agent")
      }
    })
    .select("id, recorded_at")
    .single();

  if (insertError) {
    return writeDriverLocationViaPostgres(input, request, insertError.message);
  }

  await updateLocationSession({
    client,
    projectId: String(tokenRow.project_id),
    assignmentId: String(tokenRow.assignment_id),
    driverId: typeof tokenRow.driver_id === "string" ? tokenRow.driver_id : null,
    vehicleId,
    recordedAt,
    trackingEvent: input.trackingEvent
  });

  if (input.trackingEvent === "sharing_started" || input.trackingEvent === "sharing_stopped") {
    await createTimelineEvent({
      projectId: String(tokenRow.project_id),
      objectType: "driver_location",
      objectId: String(tokenRow.assignment_id || inserted.id),
      eventType: input.trackingEvent === "sharing_started" ? TIMELINE_EVENTS.DRIVER_LOCATION_SHARING_STARTED : TIMELINE_EVENTS.DRIVER_LOCATION_SHARING_STOPPED,
      source: "driver_qr",
      reason: input.trackingEvent === "sharing_started" ? "คนขับเริ่มแชร์ตำแหน่งจาก web app" : "คนขับหยุดแชร์ตำแหน่งจาก web app",
      afterData: {
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy ?? null,
        recordedAt
      },
      metadata: { pilot: true }
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      id: inserted.id,
      recordedAt: inserted.recorded_at
    }
  });
}

async function writeDriverLocationViaPostgres(input: LocationInput, request: Request, fallbackReason: string) {
  const sql = getPostgresClient();
  if (!sql) {
    return NextResponse.json({ success: false, error: fallbackReason }, { status: 503 });
  }

  const tokenHash = hashDriverAccessToken(input.token);
  const tokenRows = await sql<TokenRow[]>`
    select project_id, assignment_id, driver_id, expires_at
    from driver_access_tokens
    where token_hash = ${tokenHash}
      and status = 'active'
    limit 1
  `;
  const tokenRow = tokenRows[0];
  if (!tokenRow) {
    return NextResponse.json({ success: false, error: "QR หรือ token ไม่ถูกต้อง กรุณาขอ QR ใหม่จากศูนย์ควบคุม" }, { status: 403 });
  }
  if (tokenRow.expires_at && new Date(tokenRow.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ success: false, error: "QR หมดอายุแล้ว กรุณาขอ QR ใหม่จากศูนย์ควบคุม" }, { status: 403 });
  }

  const assignmentRows = await sql<Array<{ vehicle_id: string | null }>>`
    select vehicle_id from assignments where id = ${tokenRow.assignment_id} limit 1
  `;
  const vehicleId = assignmentRows[0]?.vehicle_id ?? null;
  const recordedAt = input.recordedAt || new Date().toISOString();
  const metadata = JSON.stringify({ ...input.metadata, pilot: true, source: "postgres_direct", userAgent: request.headers.get("user-agent") });

  const inserted = await sql<Array<{ id: string; recorded_at: string }>>`
    insert into gps_locations (project_id, assignment_id, driver_id, vehicle_id, latitude, longitude, accuracy, recorded_at, source, sharing_event, metadata)
    values (${tokenRow.project_id}, ${tokenRow.assignment_id}, ${tokenRow.driver_id}, ${vehicleId}, ${input.latitude}, ${input.longitude}, ${input.accuracy ?? null}, ${recordedAt}, ${"driver_web_app"}, ${input.trackingEvent}, ${metadata}::jsonb)
    returning id, recorded_at
  `;

  if (input.trackingEvent === "sharing_started") {
    await sql`
      insert into driver_location_sessions (project_id, assignment_id, driver_id, vehicle_id, started_at, consent_given_at, status, last_ping_at, metadata)
      values (${tokenRow.project_id}, ${tokenRow.assignment_id}, ${tokenRow.driver_id}, ${vehicleId}, ${recordedAt}, ${recordedAt}, ${"healthy"}, ${recordedAt}, ${JSON.stringify({ source: "web_driver" })}::jsonb)
    `;
  } else {
    await sql`
      update driver_location_sessions
      set status = ${input.trackingEvent === "sharing_stopped" ? "offline" : "healthy"},
          last_ping_at = ${recordedAt},
          stopped_at = ${input.trackingEvent === "sharing_stopped" ? recordedAt : null}
      where id = (
        select id from driver_location_sessions
        where assignment_id = ${tokenRow.assignment_id}
          and stopped_at is null
        order by started_at desc
        limit 1
      )
    `;
  }

  if (input.trackingEvent === "sharing_started" || input.trackingEvent === "sharing_stopped") {
    await sql`
      insert into timeline_events (project_id, object_type, object_id, event_type, source, reason, after_data, metadata)
      values (${tokenRow.project_id}, ${"driver_location"}, ${tokenRow.assignment_id}, ${input.trackingEvent === "sharing_started" ? TIMELINE_EVENTS.DRIVER_LOCATION_SHARING_STARTED : TIMELINE_EVENTS.DRIVER_LOCATION_SHARING_STOPPED}, ${"driver_qr"}, ${input.trackingEvent === "sharing_started" ? "คนขับเริ่มแชร์ตำแหน่งจาก web app" : "คนขับหยุดแชร์ตำแหน่งจาก web app"}, ${JSON.stringify({ latitude: input.latitude, longitude: input.longitude, accuracy: input.accuracy ?? null, recordedAt })}::jsonb, ${JSON.stringify({ pilot: true, source: "postgres_direct" })}::jsonb)
    `;
  }

  return NextResponse.json({
    success: true,
    data: {
      id: inserted[0]?.id,
      recordedAt: inserted[0]?.recorded_at || recordedAt
    }
  });
}
