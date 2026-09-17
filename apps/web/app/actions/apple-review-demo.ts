"use server";

import { randomUUID } from "crypto";
import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getDatabaseErrorMessage } from "@/lib/actions/db-error";
import { withTimeout } from "@/lib/async/timeout";
import { generateDriverAccessToken, generateDriverPin, hashDriverAccessToken, hashDriverPin } from "@/lib/driver-access/token";
import { buildDriverAccessUrl } from "@/lib/driver-access/url";
import { buildWebDriverAssignmentPacket } from "@/lib/driver/assignment-packet";
import { getRequestBaseUrl } from "@/lib/request-origin";
import { getSupabaseConnectionMessage } from "@/lib/supabase/errors";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

// The demo job Apple's reviewer signs into.
//
// Three things killed the last one, and each is answered here deliberately:
//
//   1. It was tagged `smokeTest: true`, which is exactly what
//      purge_smoke_test_data() keys on — so the tool labelled "clear test data"
//      was the tool that destroyed the reviewer's access. This one is tagged
//      `appleReview` and is never smoke-tagged.
//   2. Its token expired in 24 hours. Apple reviewed days later and met
//      "ไม่พบงานสำหรับลิงก์นี้". `expires_at` is null here, which every read path
//      already treats as "never expires" — the token string itself carries no
//      expiry, so there is nothing else to change.
//   3. There was no `driver_checkins` row, so the reviewer landed on a Thai-only
//      preflight demanding live camera photos of a vehicle and its plate before
//      the job screen. A `ready` row with the four confirmations set skips
//      straight to the job, which is what Apple is there to look at.
//
// The project is real and every function works on it. It is only hidden from the
// operator's project list — see getVisibleProjects().

const APPLE_TAG = { appleReview: true, source: "apple-review-demo" } as const;

type InsertStep = {
  label: string;
  run: () => PromiseLike<{ error: unknown }>;
};

async function runInsertStep(step: InsertStep) {
  try {
    const { error } = await withTimeout(step.run(), 5000, step.label);
    if (error) return getDatabaseErrorMessage(error, `${step.label} ไม่สำเร็จ`);
    return null;
  } catch (error) {
    return getSupabaseConnectionMessage(error);
  }
}

function baseRecord(id: string) {
  const now = new Date().toISOString();
  return { id, createdAt: now, updatedAt: now, metadata: {} };
}

export interface AppleReviewDemoStatus {
  exists: boolean;
  projectId?: string;
  projectCode?: string;
  callSign?: string;
  /** Null means the token never expires, which is what this demo wants. */
  expiresAt?: string | null;
  activated?: boolean;
  createdAt?: string;
}

/** What exists right now, so the page can say whether Apple has a working link. */
export async function getAppleReviewDemoStatusAction(): Promise<ActionResult> {
  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ระบบยังไม่พร้อมอ่านข้อมูล");

  const { data: project } = await client
    .from("projects")
    .select("id, project_code, created_at")
    .filter("metadata->>appleReview", "eq", "true")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!project) return actionSuccess({ exists: false } satisfies AppleReviewDemoStatus);

  const [{ data: token }, { data: callSign }] = await Promise.all([
    client
      .from("driver_access_tokens")
      .select("expires_at, assignment_id")
      .eq("project_id", project.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
    client.from("call_signs").select("call_sign").eq("project_id", project.id).limit(1).maybeSingle()
  ]);

  const { data: checkin } = token?.assignment_id
    ? await client.from("driver_checkins").select("id").eq("assignment_id", token.assignment_id).eq("status", "ready").limit(1).maybeSingle()
    : { data: null };

  return actionSuccess({
    exists: true,
    projectId: String(project.id),
    projectCode: String(project.project_code),
    callSign: callSign ? String(callSign.call_sign) : undefined,
    expiresAt: (token?.expires_at as string | null) ?? null,
    activated: Boolean(checkin),
    createdAt: String(project.created_at)
  } satisfies AppleReviewDemoStatus);
}

/**
 * Build a fresh demo job and return the URL and PIN to paste into App Store
 * Connect. Any previous demo is deleted first, so there is only ever one and its
 * link is unambiguous.
 */
export async function createAppleReviewDemoAction(): Promise<ActionResult> {
  const { client, error } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "ระบบยังไม่พร้อมบันทึกข้อมูล");

  const previous = await client.from("projects").select("id").filter("metadata->>appleReview", "eq", "true");
  for (const row of previous.data ?? []) {
    // delete_project() is the only path past the timeline_events immutability
    // trigger; a plain delete takes the whole statement down with it.
    await client.rpc("delete_project", { target_project: row.id }).then(undefined, () => undefined);
  }

  const ids = {
    organization: randomUUID(),
    profile: randomUUID(),
    project: randomUUID(),
    day: randomUUID(),
    mission: randomUUID(),
    callSign: randomUUID(),
    driver: randomUUID(),
    vehicle: randomUUID(),
    assignment: randomUUID(),
    token: randomUUID(),
    packet: randomUUID(),
    checkin: randomUUID()
  };

  const today = new Date().toISOString().slice(0, 10);
  const startTime = `${today}T02:00:00.000Z`;
  const endTime = `${today}T14:00:00.000Z`;
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  const projectCode = `APPLE-REVIEW-${suffix}`;
  const pickupLocation = "Suvarnabhumi Airport";
  const dropoffLocation = "Bangkok city centre";

  const { data: organization } = await client.from("organizations").select("id").limit(1).maybeSingle();
  const organizationId = organization ? String(organization.id) : ids.organization;

  const project = {
    ...baseRecord(ids.project),
    organizationId,
    ownerProfileId: null,
    projectCode,
    projectName: "Apple App Review demo",
    startDate: today,
    endDate: today,
    timezone: "Asia/Bangkok",
    status: "published" as const,
    visibilityLevel: "internal",
    serviceLevel: "standard"
  };
  const assignment = {
    ...baseRecord(ids.assignment),
    projectId: ids.project,
    missionId: ids.mission,
    callSignId: ids.callSign,
    vehicleId: ids.vehicle,
    driverId: ids.driver,
    status: "active" as const,
    startTime,
    endTime,
    commitmentId: null,
    currentVersion: 1,
    metadata: { pickupLocation, dropoffLocation, coordinatorPhone: "+6620000000", operationPhone: "+6621111111" }
  };
  const callSign = {
    ...baseRecord(ids.callSign),
    projectId: ids.project,
    callSign: "REVIEW-01",
    groupName: "App Review",
    status: "active" as const,
    driverId: ids.driver,
    vehicleId: ids.vehicle
  };
  const driver = { ...baseRecord(ids.driver), organizationId, vendorId: null, fullName: "Demo Driver", phone: "+66810000000", licenseType: "demo", languages: ["en"], status: "assigned" as const };
  const vehicle = { ...baseRecord(ids.vehicle), organizationId, vendorId: null, plateNumber: `REVIEW-${suffix.slice(-3)}`, vehicleType: "Van", capacity: 8, status: "assigned" as const };

  const packet = buildWebDriverAssignmentPacket({ project, assignment, callSign, driver, vehicle, missionName: "Apple App Review demo run" });
  // No expiry. Review can happen days after submission, and a token that dies in
  // the queue is the single failure this whole tool exists to prevent.
  const token = generateDriverAccessToken({ callSignId: ids.callSign, assignmentId: ids.assignment, driverId: ids.driver, expiresAt: null });
  const pin = generateDriverPin();

  const steps: InsertStep[] = [
    {
      label: "สร้างโครงการสาธิต",
      run: () =>
        client.from("projects").insert({
          id: ids.project,
          organization_id: organizationId,
          project_code: projectCode,
          project_name: project.projectName,
          start_date: today,
          end_date: today,
          timezone: "Asia/Bangkok",
          status: "published",
          visibility_level: "internal",
          service_level: "standard",
          metadata: APPLE_TAG
        })
    },
    {
      label: "สร้างวันปฏิบัติการ",
      run: () =>
        client.from("project_days").insert({
          id: ids.day,
          project_id: ids.project,
          operation_date: today,
          day_number: 1,
          timezone: "Asia/Bangkok",
          // project_days runs draft → ready → operating → closed. "active" is
          // the assignments vocabulary and fails this table's CHECK constraint.
          status: "operating",
          metadata: APPLE_TAG
        })
    },
    {
      label: "สร้างภารกิจ",
      run: () =>
        client.from("missions").insert({
          id: ids.mission,
          project_id: ids.project,
          project_day_id: ids.day,
          mission_code: `MIS-${suffix}`,
          mission_name: "Apple App Review demo run",
          mission_type: "transfer",
          priority: "normal",
          status: "published",
          planned_start_time: startTime,
          planned_end_time: endTime,
          instruction: "Open the job, share GPS, send a message and a photo.",
          metadata: { ...APPLE_TAG, pickupLocation, dropoffLocation }
        })
    },
    {
      label: "สร้างรถ",
      run: () =>
        client.from("vehicles").insert({
          id: ids.vehicle,
          organization_id: organizationId,
          plate_number: vehicle.plateNumber,
          vehicle_type: "Van",
          capacity: 8,
          status: "assigned",
          metadata: APPLE_TAG
        })
    },
    {
      label: "สร้างคนขับ",
      run: () =>
        client.from("drivers").insert({
          id: ids.driver,
          organization_id: organizationId,
          full_name: "Demo Driver",
          phone: "+66810000000",
          license_type: "demo",
          languages: ["en"],
          status: "assigned",
          metadata: APPLE_TAG
        })
    },
    {
      label: "สร้างหน่วยรถ",
      run: () =>
        client.from("call_signs").insert({
          id: ids.callSign,
          project_id: ids.project,
          call_sign: "REVIEW-01",
          group_name: "App Review",
          status: "active",
          driver_id: ids.driver,
          vehicle_id: ids.vehicle,
          metadata: { ...APPLE_TAG, crewedUnit: true }
        })
    },
    {
      label: "สร้างงาน",
      run: () =>
        client.from("assignments").insert({
          id: ids.assignment,
          project_id: ids.project,
          mission_id: ids.mission,
          call_sign_id: ids.callSign,
          vehicle_id: ids.vehicle,
          driver_id: ids.driver,
          status: "active",
          start_time: startTime,
          end_time: endTime,
          current_version: 1,
          metadata: assignment.metadata
        })
    },
    {
      label: "สร้าง QR ถาวร",
      run: () =>
        client.from("driver_access_tokens").insert({
          id: ids.token,
          project_id: ids.project,
          assignment_id: ids.assignment,
          call_sign_id: ids.callSign,
          driver_id: ids.driver,
          token_hash: hashDriverAccessToken(token),
          access_scope: "call_sign",
          status: "active",
          expires_at: null,
          metadata: { ...APPLE_TAG, tokenVersion: 2, pinHash: hashDriverPin(pin), pinAttempts: 0 }
        })
    },
    {
      label: "สร้างชุดข้อมูลงาน",
      run: () =>
        client.from("driver_assignment_packets").insert({
          id: ids.packet,
          project_id: ids.project,
          assignment_id: ids.assignment,
          call_sign_id: ids.callSign,
          driver_id: ids.driver,
          packet_version: 1,
          payload: packet,
          published_at: new Date().toISOString(),
          metadata: APPLE_TAG
        })
    },
    {
      label: "ปลดด่านตรวจก่อนเริ่มงาน",
      run: () =>
        client.from("driver_checkins").insert({
          id: ids.checkin,
          project_id: ids.project,
          assignment_id: ids.assignment,
          driver_id: ids.driver,
          status: "ready",
          confirmed_name: true,
          confirmed_phone: true,
          confirmed_vehicle: true,
          gps_consent: true,
          metadata: APPLE_TAG
        })
    }
  ];

  for (const step of steps) {
    const failure = await runInsertStep(step);
    if (failure) return actionFailure(`${step.label}: ${failure}`);
  }

  const accessUrl = buildDriverAccessUrl(await getRequestBaseUrl(), token);
  return actionSuccess({ accessUrl, pin, projectCode, callSign: "REVIEW-01" });
}
