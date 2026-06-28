import { ReadinessScoreCard } from "@/components/readiness/readiness-score-card";
import { getDriverReadinessScore, getVehicleReadinessScore } from "@/lib/domain/driver-readiness";

export function ReadinessBoard() {
  const driverScore = getDriverReadinessScore({
    confirmedName: true,
    confirmedPhone: false,
    confirmedVehicle: true,
    vehiclePhotoCaptured: false,
    platePhotoCaptured: false,
    gpsConsent: false
  });
  const vehicleScore = getVehicleReadinessScore({
    vehicleType: "van",
    plateNumber: "DEMO-1001",
    capacity: 8,
    outOfService: false,
    photoCaptured: false,
    platePhotoCaptured: false
  });

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <ReadinessScoreCard title="Driver readiness" score={driverScore} status="warning" />
      <ReadinessScoreCard title="Vehicle readiness" score={vehicleScore} status="warning" />
    </section>
  );
}
