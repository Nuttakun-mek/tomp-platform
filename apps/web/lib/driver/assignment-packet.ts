import { buildGoogleMapsDirectionsUrl } from "@tomp/driver-core";
import type { Assignment, CallSign, Driver, DriverAssignmentPacket, Project, Vehicle } from "@tomp/types/domain";

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function buildWebDriverAssignmentPacket(input: {
  project: Project;
  assignment: Assignment;
  callSign: CallSign;
  driver?: Driver | null;
  vehicle?: Vehicle | null;
  missionName?: string | null;
}): DriverAssignmentPacket {
  const pickup = text(input.assignment.metadata.pickupLocation || input.assignment.metadata.pickup_location, "ยังไม่ระบุจุดรับ");
  const dropoff = text(input.assignment.metadata.dropoffLocation || input.assignment.metadata.dropoff_location, "ยังไม่ระบุจุดส่ง");
  const mapsUrl = buildGoogleMapsDirectionsUrl(dropoff, pickup);

  return {
    id: input.assignment.id,
    projectId: input.project.id,
    assignmentId: input.assignment.id,
    driverId: input.driver?.id ?? input.assignment.driverId ?? null,
    callSign: input.callSign.callSign,
    status: input.assignment.status === "completed" ? "completed" : "assigned",
    packetVersion: input.assignment.currentVersion,
    projectName: input.project.projectName,
    missionName: input.missionName ?? null,
    instructions: [
      { id: input.assignment.id, title: "รับทราบงาน", status: "assigned", sequence: 1, required: true },
      { id: input.callSign.id, title: "ยืนยันความพร้อม", status: "acknowledged", sequence: 2, required: true }
    ],
    routeInstruction: {
      routePlan: {
        summary: `${pickup} ไป ${dropoff}`,
        stops: [{ label: pickup }, { label: dropoff }],
        googleMapsUrl: mapsUrl,
        metadata: {}
      },
      pickup: { label: pickup },
      dropoff: { label: dropoff }
    },
    contactInstruction: {
      coordinatorPhone: text(input.assignment.metadata.coordinatorPhone || input.assignment.metadata.coordinator_phone, "ยังไม่ระบุ"),
      operationPhone: text(input.assignment.metadata.operationPhone || input.assignment.metadata.operation_phone, "ยังไม่ระบุ")
    },
    safetyInstructions: [{ message: "เปิด GPS ระหว่างปฏิบัติงานเมื่อพร้อม", required: true }],
    metadata: {
      vehiclePlate: input.vehicle?.plateNumber ?? null,
      vehicleType: input.vehicle?.vehicleType ?? null
    }
  };
}
