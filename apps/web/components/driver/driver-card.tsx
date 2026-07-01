import { buildDriverAssignmentPacket, buildGoogleMapsDirectionsUrl } from "@tomp/driver-core";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";
import { DriverAssignmentAcknowledgement } from "./driver-assignment-acknowledgement";
import { DriverEmergencyActions } from "./driver-emergency-actions";
import { DriverLocationShare } from "./driver-location-share";
import { DriverNextAction } from "./driver-next-action";
import { DriverNotificationPanel } from "./driver-notification-panel";
import { DriverReadinessCard } from "./driver-readiness-card";
import { DriverRouteCard } from "./driver-route-card";
import { DriverRouteChangeAlert } from "./driver-route-change-alert";
import { DriverTaskHero } from "./driver-task-hero";

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function DriverCard({ driverAccess }: { driverAccess: DriverAccessAssignment }) {
  const pickupLabel = text(driverAccess.assignment.metadata.pickupLocation || driverAccess.assignment.metadata.pickup_location, "ยังไม่ระบุจุดรับ");
  const dropoffLabel = text(driverAccess.assignment.metadata.dropoffLocation || driverAccess.assignment.metadata.dropoff_location, "ยังไม่ระบุจุดส่ง");
  const commitmentTime = text(driverAccess.assignment.metadata.commitmentTime || driverAccess.assignment.metadata.commitment_time, "ยังไม่ระบุเวลา");
  const mapsUrl = buildGoogleMapsDirectionsUrl(dropoffLabel, pickupLabel);
  const packet = buildDriverAssignmentPacket({
    id: driverAccess.assignment.id,
    projectId: driverAccess.project.id,
    assignmentId: driverAccess.assignment.id,
    driverId: driverAccess.driver.id,
    callSign: driverAccess.callSign.callSign,
    status: "assigned",
    packetVersion: driverAccess.assignment.currentVersion,
    projectName: driverAccess.project.projectName,
    missionName: null,
    instructions: [
      { id: driverAccess.assignment.id, title: "รับทราบงาน", status: "assigned", sequence: 1, required: true }
    ],
    routeInstruction: {
      routePlan: { summary: `${pickupLabel} ไป ${dropoffLabel}`, stops: [{ label: pickupLabel }, { label: dropoffLabel }], googleMapsUrl: mapsUrl, metadata: {} },
      pickup: { label: pickupLabel },
      dropoff: { label: dropoffLabel }
    },
    contactInstruction: { coordinatorPhone: "ยังไม่ระบุ", operationPhone: "ยังไม่ระบุ" },
    safetyInstructions: [{ message: "เปิด GPS ระหว่างปฏิบัติงานเมื่อพร้อม", required: true }],
    metadata: { source: "web_driver" }
  });

  return (
    <div className="mx-auto grid max-w-2xl gap-5 pb-24 lg:max-w-5xl lg:grid-cols-[0.95fr_1.05fr] lg:pb-0">
      <div className="grid content-start gap-5">
        <DriverTaskHero driverAccess={driverAccess} mapsUrl={mapsUrl} packet={packet} />
        <DriverRouteCard pickup={pickupLabel} dropoff={dropoffLabel} commitmentTime={commitmentTime} summary={packet.routeInstruction.routePlan.summary} />
        <DriverAssignmentAcknowledgement driverAccess={driverAccess} />
        <DriverEmergencyActions />
      </div>
      <div className="grid content-start gap-5">
        <DriverNextAction driverAccess={driverAccess} mapsUrl={mapsUrl} packet={packet} />
        <DriverLocationShare driverAccess={driverAccess} />
        <DriverReadinessCard driverAccess={driverAccess} />
        <DriverNotificationPanel driverAccess={driverAccess} />
        <DriverRouteChangeAlert driverAccess={driverAccess} />
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 shadow-panel backdrop-blur lg:hidden">
        <a className="flex min-h-14 items-center justify-center rounded-xl bg-route px-4 py-3 text-base font-semibold text-white" href={mapsUrl}>
          เปิด Google Maps
        </a>
      </div>
    </div>
  );
}
