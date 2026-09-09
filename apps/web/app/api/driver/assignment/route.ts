import { NextResponse } from "next/server";
import { buildDriverAssignmentPacket, buildGoogleMapsDirectionsUrl } from "@tomp/driver-core";
import { resolveDriverSession } from "@/lib/api/driver-token";
import { getDriverAssignmentBySession } from "@/lib/data/driver-access";

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export async function GET(request: Request) {
  const auth = await resolveDriverSession(request);
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const driverAccess = await getDriverAssignmentBySession(auth.context);
  if (!driverAccess) {
    return NextResponse.json({ success: false, error: "ไม่พบงานที่เชื่อมกับ session นี้ หรือสิทธิ์การเข้าถึงหมดอายุแล้ว" }, { status: 404 });
  }

  const pickupLabel = text(driverAccess.assignment.metadata.pickupLocation || driverAccess.assignment.metadata.pickup_location, "ยังไม่ระบุจุดรับ");
  const dropoffLabel = text(driverAccess.assignment.metadata.dropoffLocation || driverAccess.assignment.metadata.dropoff_location, "ยังไม่ระบุจุดส่ง");
  const commitmentTime = text(driverAccess.assignment.metadata.commitmentTime || driverAccess.assignment.metadata.commitment_time, "ยังไม่ระบุเวลา");
  const mapsUrl = buildGoogleMapsDirectionsUrl(dropoffLabel, pickupLabel);
  const packet =
    driverAccess.packet ??
    buildDriverAssignmentPacket({
      id: driverAccess.assignment.id,
      projectId: driverAccess.project.id,
      assignmentId: driverAccess.assignment.id,
      driverId: driverAccess.driver.id,
      callSign: driverAccess.callSign.callSign,
      status: "assigned",
      packetVersion: driverAccess.assignment.currentVersion,
      projectName: driverAccess.project.projectName,
      missionName: null,
      instructions: [{ id: driverAccess.assignment.id, title: "รับทราบงาน", status: "assigned", sequence: 1, required: true }],
      routeInstruction: {
        routePlan: { summary: `${pickupLabel} ไป ${dropoffLabel}`, stops: [{ label: pickupLabel }, { label: dropoffLabel }], googleMapsUrl: mapsUrl, metadata: {} },
        pickup: { label: pickupLabel },
        dropoff: { label: dropoffLabel }
      },
      contactInstruction: { coordinatorPhone: "ยังไม่ระบุ", operationPhone: "ยังไม่ระบุ" },
      safetyInstructions: [{ message: "เปิด GPS ระหว่างปฏิบัติงานเมื่อพร้อม", required: true }],
      metadata: { source: "mobile_driver_api" }
    });

  return NextResponse.json({
    success: true,
    data: {
      packet,
      project: driverAccess.project,
      assignment: driverAccess.assignment,
      callSign: driverAccess.callSign,
      driver: driverAccess.driver,
      vehicle: driverAccess.vehicle,
      route: {
        pickupLabel,
        dropoffLabel,
        commitmentTime,
        mapsUrl
      },
      notifications: driverAccess.notifications,
      routeChanges: driverAccess.routeChanges
    }
  }, { headers: { "Cache-Control": "no-store" } });
}
