"use server";

import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { generateDriverAccessToken, getDefaultDriverTokenExpiry, hashDriverAccessToken } from "@/lib/driver-access/token";
import { buildDriverAccessUrl } from "@/lib/driver-access/url";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";
import { createTimelineEvent, TIMELINE_EVENTS } from "@/lib/timeline";

const ids = {
  organization: "30000000-0000-4000-8000-000000000001",
  profile: "30000000-0000-4000-8000-000000000002",
  project: "30000000-0000-4000-8000-000000000003",
  day: "30000000-0000-4000-8000-000000000004",
  session: "30000000-0000-4000-8000-000000000005",
  mission: "30000000-0000-4000-8000-000000000006",
  callSign: "30000000-0000-4000-8000-000000000007",
  vehicle: "30000000-0000-4000-8000-000000000008",
  driver: "30000000-0000-4000-8000-000000000009",
  assignment: "30000000-0000-4000-8000-000000000010"
};

export async function createLiveGpsPilotScenarioAction(): Promise<ActionResult> {
  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ยังไม่ได้ตั้งค่าการบันทึกข้อมูล");

  try {
    const now = new Date();
    const startTime = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
    const endTime = new Date(now.getTime() + 90 * 60 * 1000).toISOString();
    const today = now.toISOString().slice(0, 10);

    const steps = [
      client.from("organizations").upsert({
        id: ids.organization,
        name: "TOMP Live GPS Pilot",
        organization_type: "operator",
        status: "active",
        metadata: { pilot: true, liveGpsTest: true }
      }),
      client.from("profiles").upsert({
        id: ids.profile,
        auth_user_id: null,
        organization_id: ids.organization,
        full_name: "ผู้ดูแลทดสอบ GPS",
        email: "live-gps-pilot@example.com",
        phone: "+6620000000",
        status: "active",
        metadata: { pilot: true }
      }),
      client.from("projects").upsert(
        {
          id: ids.project,
          organization_id: ids.organization,
          owner_profile_id: ids.profile,
          project_code: "LIVE-GPS-PILOT",
          project_name: "ทดสอบติดตามคนขับแบบเรียลไทม์",
          start_date: today,
          end_date: today,
          timezone: "Asia/Bangkok",
          status: "planning",
          visibility_level: "internal",
          service_level: "standard",
          metadata: { pilot: true, liveGpsTest: true }
        },
        { onConflict: "id" }
      ),
      client.from("project_days").upsert({
        id: ids.day,
        project_id: ids.project,
        operation_date: today,
        day_number: 1,
        timezone: "Asia/Bangkok",
        status: "draft",
        briefing_notes: "ชุดทดสอบ GPS สดสำหรับ internal pilot",
        metadata: { pilot: true }
      }),
      client.from("sessions").upsert({
        id: ids.session,
        project_id: ids.project,
        project_day_id: ids.day,
        session_name: "รอบทดสอบ GPS สด",
        session_type: "live_gps_test",
        start_time: startTime,
        end_time: endTime,
        status: "draft",
        metadata: { pilot: true }
      }),
      client.from("missions").upsert({
        id: ids.mission,
        project_id: ids.project,
        project_day_id: ids.day,
        session_id: ids.session,
        mission_code: "LIVE-GPS-M01",
        mission_name: "รับส่งทดสอบ GPS สด",
        mission_type: "driver_tracking_test",
        priority: "normal",
        status: "draft",
        planned_start_time: startTime,
        planned_end_time: endTime,
        instruction: "ให้คนขับเปิดหน้าคนขับและกดเริ่มแชร์ GPS",
        service_commitment: "ศูนย์ควบคุมต้องเห็นตำแหน่งบน Mission Control",
        metadata: {
          pickupLocation: "จุดรับผู้โดยสาร",
          dropoffLocation: "จุดส่งปลายทาง",
          commitmentTime: new Date(startTime).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })
        }
      }),
      client.from("call_signs").upsert({
        id: ids.callSign,
        project_id: ids.project,
        call_sign: "LIVE-01",
        group_name: "ทดสอบ GPS สด",
        status: "active",
        metadata: { pilot: true }
      }),
      client.from("vehicles").upsert({
        id: ids.vehicle,
        organization_id: ids.organization,
        vendor_id: null,
        plate_number: "TEST-1001",
        vehicle_type: "รถทดสอบ",
        capacity: 4,
        status: "assigned",
        metadata: { pilot: true }
      }),
      client.from("drivers").upsert({
        id: ids.driver,
        organization_id: ids.organization,
        vendor_id: null,
        full_name: "คนขับทดสอบ GPS",
        phone: "+66810000000",
        license_type: "pilot",
        languages: ["th"],
        status: "assigned",
        metadata: { pilot: true }
      }),
      client.from("assignments").upsert({
        id: ids.assignment,
        project_id: ids.project,
        mission_id: ids.mission,
        call_sign_id: ids.callSign,
        vehicle_id: ids.vehicle,
        driver_id: ids.driver,
        status: "planned",
        start_time: startTime,
        end_time: endTime,
        current_version: 1,
        metadata: {
          pilot: true,
          pickupLocation: "จุดรับผู้โดยสาร",
          dropoffLocation: "จุดส่งปลายทาง",
          commitmentTime: new Date(startTime).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
          coordinatorPhone: "+6620000000",
          operationPhone: "+6621111111"
        }
      })
    ];

    for (const step of steps) {
      const { error: stepError } = await step;
      if (stepError) return actionFailure(getDatabaseErrorMessage(stepError, "สร้างชุดทดสอบ GPS ไม่สำเร็จ"));
    }

    const expiresAt = getDefaultDriverTokenExpiry();
    const token = generateDriverAccessToken({
      assignmentId: ids.assignment,
      driverId: ids.driver,
      expiresAt
    });
    const { data: tokenRow, error: tokenError } = await client
      .from("driver_access_tokens")
      .insert({
        project_id: ids.project,
        assignment_id: ids.assignment,
        driver_id: ids.driver,
        token_hash: hashDriverAccessToken(token),
        status: "active",
        expires_at: expiresAt,
        metadata: { pilot: true, createdBy: "live_test_action" }
      })
      .select("id")
      .single();

    if (tokenError) return actionFailure(getDatabaseErrorMessage(tokenError, "สร้างลิงก์ QR สำหรับคนขับไม่สำเร็จ"));

    await createTimelineEvent({
      projectId: ids.project,
      objectType: "assignment",
      objectId: ids.assignment,
      eventType: TIMELINE_EVENTS.DRIVER_ACCESS_TOKEN_CREATED,
      source: "operation_user",
      reason: "สร้างชุดทดสอบ GPS สดและลิงก์คนขับ",
      afterData: { tokenId: tokenRow.id, assignmentId: ids.assignment }
    });

    return actionSuccess({
      projectId: ids.project,
      assignmentId: ids.assignment,
      driverId: ids.driver,
      accessUrl: buildDriverAccessUrl(token),
      missionControlUrl: `/mission-control?projectId=${ids.project}`,
      assignmentsUrl: `/projects/${ids.project}/assignments`
    });
  } catch (caught) {
    return actionFailure(caught instanceof Error ? caught.message : "สร้างชุดทดสอบ GPS ไม่สำเร็จ");
  }
}
