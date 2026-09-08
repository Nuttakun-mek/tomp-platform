import { cookies } from "next/headers";
import { DriverPinGate } from "@/components/driver/driver-pin-gate";
import { DriverPreflight } from "@/components/driver/driver-preflight";
import { DriverTaskView } from "@/components/driver/driver-task-view";
import { getDriverAssignmentByToken } from "@/lib/data/driver-access";
import { DRIVER_PIN_COOKIE_PREFIX } from "@/lib/driver-access/token";

interface DriverPageProps {
  searchParams?: Promise<{ token?: string }>;
}

export default async function DriverPage({ searchParams }: DriverPageProps) {
  const params = searchParams ? await searchParams : {};
  const token = params.token || "";
  const driverAccess = token ? await getDriverAssignmentByToken(token) : null;

  if (!driverAccess) {
    return (
      <div className="grid min-h-[70vh] content-center gap-2 text-center">
        <h1 className="text-lg font-bold text-ink">ไม่พบงานสำหรับลิงก์นี้</h1>
        <p className="mx-auto max-w-sm text-[13px] leading-6 text-ink-soft">
          ลิงก์อาจหมดอายุหรือถูกยกเลิก กรุณาติดต่อศูนย์ควบคุมเพื่อขอลิงก์และรหัสใหม่
        </p>
      </div>
    );
  }

  if (driverAccess.pinRequired) {
    const store = await cookies();
    const verified = store.get(`${DRIVER_PIN_COOKIE_PREFIX}${driverAccess.tokenId}`)?.value === "1";
    if (!verified) return <DriverPinGate token={token} />;
  }

  // Gate: identity confirmation + evidence photos happen before the driver sees
  // the job screen. `activated` is a driver_checkins row with status 'ready'.
  if (!driverAccess.activated) {
    return <DriverPreflight driverAccess={driverAccess} />;
  }

  return <DriverTaskView driverAccess={driverAccess} />;
}
