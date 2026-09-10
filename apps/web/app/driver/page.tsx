import { cookies } from "next/headers";
import { DriverPinGate } from "@/components/driver/driver-pin-gate";
import { DriverPreflight } from "@/components/driver/driver-preflight";
import { DriverSessionGate } from "@/components/driver/driver-session-gate";
import { DriverTaskView } from "@/components/driver/driver-task-view";
import { getDriverAssignmentByToken } from "@/lib/data/driver-access";
import { DRIVER_DEVICE_COOKIE_PREFIX, DRIVER_PIN_COOKIE_PREFIX, hashDriverDeviceId } from "@/lib/driver-access/token";

interface DriverPageProps {
  searchParams?: Promise<{ token?: string }>;
}

function DriverNotice({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="grid min-h-[70vh] content-center gap-2 text-center">
      <h1 className="text-lg font-bold text-ink">{title}</h1>
      <p className="mx-auto max-w-sm text-[13px] leading-6 text-ink-soft">{detail}</p>
    </div>
  );
}

export default async function DriverPage({ searchParams }: DriverPageProps) {
  const params = searchParams ? await searchParams : {};
  const token = params.token || "";
  const driverAccess = token ? await getDriverAssignmentByToken(token) : null;

  if (!driverAccess) {
    return (
      <DriverNotice
        title="ไม่พบงานสำหรับลิงก์นี้"
        detail="ลิงก์อาจหมดอายุหรือถูกยกเลิก กรุณาติดต่อศูนย์ควบคุมเพื่อขอลิงก์และรหัสใหม่"
      />
    );
  }

  const store = await cookies();

  // One QR opens the job on one device at a time. A different phone is not
  // turned away outright any more: if the token carries a PIN, knowing it is
  // enough to move the job here — that is the path back for a driver whose app
  // was reinstalled or whose handset changed, and it keeps the job (and its
  // history) on the same Mission Control card instead of spawning a second one.
  const deviceId = store.get(`${DRIVER_DEVICE_COOKIE_PREFIX}id`)?.value ?? "";
  const deviceMatches = Boolean(
    driverAccess.deviceBoundTo && deviceId && hashDriverDeviceId(deviceId) === driverAccess.deviceBoundTo
  );
  const otherDeviceHolds = Boolean(driverAccess.deviceBoundTo) && !deviceMatches;

  if (otherDeviceHolds && !driverAccess.pinRequired) {
    return (
      <DriverNotice
        title="งานนี้เปิดใช้บนอุปกรณ์อื่นแล้ว"
        detail="ลิงก์นี้ออกก่อนระบบรหัส 6 หลัก จึงย้ายเครื่องเองไม่ได้ กรุณาให้ศูนย์ควบคุมออก QR และรหัสใหม่"
      />
    );
  }

  if (driverAccess.pinRequired) {
    const verified = store.get(`${DRIVER_PIN_COOKIE_PREFIX}${driverAccess.tokenId}`)?.value === "1";
    if (!verified || otherDeviceHolds) return <DriverPinGate token={token} takeover={otherDeviceHolds} />;
  }

  // Gate: identity confirmation + evidence photos happen before the driver sees
  // the job screen. `activated` is a driver_checkins row with status 'ready'.
  // DriverSessionGate exchanges the QR token for the scoped API session first.
  return (
    <DriverSessionGate token={token}>
      {driverAccess.activated ? <DriverTaskView driverAccess={driverAccess} /> : <DriverPreflight driverAccess={driverAccess} />}
    </DriverSessionGate>
  );
}
