import { NextResponse } from "next/server";
import { driverLocationUpdateSchema } from "@tomp/types/schemas";
import { resolveDriverSession, type DriverSessionContext } from "@/lib/api/driver-token";
import { getPostgresClient } from "@/lib/db/postgres";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createTimelineEvent, TIMELINE_EVENTS } from "@/lib/timeline";

type LocationInput = typeof driverLocationUpdateSchema._type;

async function updateLocationSession(input: {
  client: NonNullable<ReturnType<typeof getSupabaseWriteClient>["client"]>;
  projectId: string;
  assignmentId: string;
  callSignId?: string | null;
  driverId: string | null;
  vehicleId: string | null;
  recordedAt: string;
  trackingEvent: "sharing_started" | "location_ping" | "sharing_stopped";
}) {
  if (input.trackingEvent === "sharing_started") {
    await input.client.from("driver_location_sessions").insert({
      project_id: input.projectId,
      assignment_id: input.assignmentId,
      call_sign_id: input.callSignId || null,
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

  // Update the open session directly by predicate — no separate select. There is
  // only ever one session per assignment with stopped_at IS NULL.
  await input.client
    .from("driver_location_sessions")
    .update({
      status: input.trackingEvent === "sharing_stopped" ? "offline" : "healthy",
      last_ping_at: input.recordedAt,
      stopped_at: input.trackingEvent === "sharing_stopped" ? input.recordedAt : null
    })
    .eq("assignment_id", input.assignmentId)
    .is("stopped_at", null);
}

export async function POST(request: Request) {
  // Session first — an unauthenticated caller gets 401, never a 400 that
  // confirms the endpoint shape (P0-2: no work before the session check).
  const auth = await resolveDriverSession(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const parsed = driverLocationUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "ข้อมูลตำแหน่งไม่ถูกต้อง", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { client, error } = getSupabaseWriteClient();
  if (!client) {
    return writeDriverLocationViaPostgres(auth.context, parsed.data, request, error || "ยังไม่ได้ตั้งค่า Supabase สำหรับรับตำแหน่ง");
  }

  try {
    return await writeDriverLocationViaSupabase(client, auth.context, parsed.data, request);
  } catch (supabaseError) {
    return writeDriverLocationViaPostgres(
      auth.context,
      parsed.data,
      request,
      supabaseError instanceof Error ? supabaseError.message : "เชื่อมต่อ Supabase ไม่สำเร็จ"
    );
  }
}

async function writeDriverLocationViaSupabase(
  client: NonNullable<ReturnType<typeof getSupabaseWriteClient>["client"]>,
  ctx: DriverSessionContext,
  input: LocationInput,
  request: Request
) {
  const { data: assignment } = await client.from("assignments").select("vehicle_id").eq("id", ctx.assignmentId).maybeSingle();
  const vehicleId = typeof assignment?.vehicle_id === "string" ? assignment.vehicle_id : null;
  const recordedAt = input.recordedAt || new Date().toISOString();

  const { data: inserted, error: insertError } = await client
    .from("gps_locations")
    .insert({
      project_id: ctx.projectId,
      assignment_id: ctx.assignmentId,
      call_sign_id: ctx.callSignId || null,
      driver_id: ctx.driverId,
      vehicle_id: vehicleId,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy ?? null,
      recorded_at: recordedAt,
      source: "driver_web_app",
      sharing_event: input.trackingEvent,
      metadata: { ...input.metadata, pilot: true, userAgent: request.headers.get("user-agent") }
    })
    .select("id, recorded_at")
    .single();

  if (insertError) {
    return writeDriverLocationViaPostgres(ctx, input, request, insertError.message);
  }

  await updateLocationSession({
    client,
    projectId: ctx.projectId,
    assignmentId: ctx.assignmentId,
    callSignId: ctx.callSignId || null,
    driverId: ctx.driverId,
    vehicleId,
    recordedAt,
    trackingEvent: input.trackingEvent
  });

  if (input.trackingEvent === "sharing_started" || input.trackingEvent === "sharing_stopped") {
    await createTimelineEvent({
      projectId: ctx.projectId,
      objectType: "driver_location",
      objectId: ctx.assignmentId || inserted.id,
      eventType: input.trackingEvent === "sharing_started" ? TIMELINE_EVENTS.DRIVER_LOCATION_SHARING_STARTED : TIMELINE_EVENTS.DRIVER_LOCATION_SHARING_STOPPED,
      source: "driver_qr",
      reason: input.trackingEvent === "sharing_started" ? "คนขับเริ่มแชร์ตำแหน่งจาก web app" : "คนขับหยุดแชร์ตำแหน่งจาก web app",
      afterData: { latitude: input.latitude, longitude: input.longitude, accuracy: input.accuracy ?? null, recordedAt },
      metadata: { pilot: true }
    });
  }

  return NextResponse.json({ success: true, data: { id: inserted.id, recordedAt: inserted.recorded_at } });
}

async function writeDriverLocationViaPostgres(ctx: DriverSessionContext, input: LocationInput, request: Request, fallbackReason: string) {
  const sql = getPostgresClient();
  if (!sql) {
    return NextResponse.json({ success: false, error: fallbackReason }, { status: 503 });
  }

  const assignmentRows = await sql<Array<{ vehicle_id: string | null }>>`
    select vehicle_id from assignments where id = ${ctx.assignmentId} limit 1
  `;
  const vehicleId = assignmentRows[0]?.vehicle_id ?? null;
  const recordedAt = input.recordedAt || new Date().toISOString();
  const metadata = JSON.stringify({ ...input.metadata, pilot: true, source: "postgres_direct", userAgent: request.headers.get("user-agent") });

  const inserted = await sql<Array<{ id: string; recorded_at: string }>>`
    insert into gps_locations (project_id, assignment_id, call_sign_id, driver_id, vehicle_id, latitude, longitude, accuracy, recorded_at, source, sharing_event, metadata)
    values (${ctx.projectId}, ${ctx.assignmentId}, ${ctx.callSignId || null}, ${ctx.driverId}, ${vehicleId}, ${input.latitude}, ${input.longitude}, ${input.accuracy ?? null}, ${recordedAt}, ${"driver_web_app"}, ${input.trackingEvent}, ${metadata}::jsonb)
    returning id, recorded_at
  `;

  if (input.trackingEvent === "sharing_started") {
    await sql`
      insert into driver_location_sessions (project_id, assignment_id, call_sign_id, driver_id, vehicle_id, started_at, consent_given_at, status, last_ping_at, metadata)
      values (${ctx.projectId}, ${ctx.assignmentId}, ${ctx.callSignId || null}, ${ctx.driverId}, ${vehicleId}, ${recordedAt}, ${recordedAt}, ${"healthy"}, ${recordedAt}, ${JSON.stringify({ source: "web_driver" })}::jsonb)
    `;
  } else {
    await sql`
      update driver_location_sessions
      set status = ${input.trackingEvent === "sharing_stopped" ? "offline" : "healthy"},
          last_ping_at = ${recordedAt},
          stopped_at = ${input.trackingEvent === "sharing_stopped" ? recordedAt : null}
      where assignment_id = ${ctx.assignmentId}
        and stopped_at is null
    `;
  }

  if (input.trackingEvent === "sharing_started" || input.trackingEvent === "sharing_stopped") {
    await sql`
      insert into timeline_events (project_id, object_type, object_id, event_type, source, reason, after_data, metadata)
      values (${ctx.projectId}, ${"driver_location"}, ${ctx.assignmentId}, ${input.trackingEvent === "sharing_started" ? TIMELINE_EVENTS.DRIVER_LOCATION_SHARING_STARTED : TIMELINE_EVENTS.DRIVER_LOCATION_SHARING_STOPPED}, ${"driver_qr"}, ${input.trackingEvent === "sharing_started" ? "คนขับเริ่มแชร์ตำแหน่งจาก web app" : "คนขับหยุดแชร์ตำแหน่งจาก web app"}, ${JSON.stringify({ latitude: input.latitude, longitude: input.longitude, accuracy: input.accuracy ?? null, recordedAt })}::jsonb, ${JSON.stringify({ pilot: true, source: "postgres_direct" })}::jsonb)
    `;
  }

  return NextResponse.json({ success: true, data: { id: inserted[0]?.id, recordedAt: inserted[0]?.recorded_at || recordedAt } });
}
