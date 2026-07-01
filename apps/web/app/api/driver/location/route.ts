import { NextResponse } from "next/server";
import { driverLocationUpdateSchema } from "@tomp/types/schemas";
import { hashDriverAccessToken } from "@/lib/driver-access/token";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createTimelineEvent, TIMELINE_EVENTS } from "@/lib/timeline";

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
    return NextResponse.json({ success: false, error: error || "ยังไม่ได้ตั้งค่า Supabase สำหรับรับตำแหน่ง" }, { status: 503 });
  }

  const tokenHash = hashDriverAccessToken(parsed.data.token);
  const { data: tokenRow, error: tokenError } = await client
    .from("driver_access_tokens")
    .select("project_id, assignment_id, driver_id, status, expires_at")
    .eq("token_hash", tokenHash)
    .eq("status", "active")
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ success: false, error: "QR หรือ token ไม่ถูกต้อง กรุณาขอ QR ใหม่จากศูนย์ควบคุม" }, { status: 403 });
  }

  if (tokenRow.expires_at && new Date(String(tokenRow.expires_at)).getTime() <= Date.now()) {
    return NextResponse.json({ success: false, error: "QR หมดอายุแล้ว กรุณาขอ QR ใหม่จากศูนย์ควบคุม" }, { status: 403 });
  }

  const { data: assignment } = await client.from("assignments").select("vehicle_id").eq("id", tokenRow.assignment_id).maybeSingle();
  const vehicleId = typeof assignment?.vehicle_id === "string" ? assignment.vehicle_id : null;
  const recordedAt = parsed.data.recordedAt || new Date().toISOString();

  const { data: inserted, error: insertError } = await client
    .from("gps_locations")
    .insert({
      project_id: tokenRow.project_id,
      assignment_id: tokenRow.assignment_id,
      driver_id: tokenRow.driver_id,
      vehicle_id: vehicleId,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      accuracy: parsed.data.accuracy ?? null,
      recorded_at: recordedAt,
      source: "driver_web_app",
      sharing_event: parsed.data.trackingEvent,
      metadata: {
        ...parsed.data.metadata,
        pilot: true,
        userAgent: request.headers.get("user-agent")
      }
    })
    .select("id, recorded_at")
    .single();

  if (insertError) {
    return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
  }

  await updateLocationSession({
    client,
    projectId: String(tokenRow.project_id),
    assignmentId: String(tokenRow.assignment_id),
    driverId: typeof tokenRow.driver_id === "string" ? tokenRow.driver_id : null,
    vehicleId,
    recordedAt,
    trackingEvent: parsed.data.trackingEvent
  });

  if (parsed.data.trackingEvent === "sharing_started" || parsed.data.trackingEvent === "sharing_stopped") {
    await createTimelineEvent({
      projectId: String(tokenRow.project_id),
      objectType: "driver_location",
      objectId: String(tokenRow.assignment_id || inserted.id),
      eventType:
        parsed.data.trackingEvent === "sharing_started"
          ? TIMELINE_EVENTS.DRIVER_LOCATION_SHARING_STARTED
          : TIMELINE_EVENTS.DRIVER_LOCATION_SHARING_STOPPED,
      source: "driver_qr",
      reason: parsed.data.trackingEvent === "sharing_started" ? "คนขับเริ่มแชร์ตำแหน่งจาก web app" : "คนขับหยุดแชร์ตำแหน่งจาก web app",
      afterData: {
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        accuracy: parsed.data.accuracy ?? null,
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
