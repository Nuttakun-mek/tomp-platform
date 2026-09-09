import { cookies } from "next/headers";
import { DriverPinGate } from "@/components/driver/driver-pin-gate";
import { DriverPreflight } from "@/components/driver/driver-preflight";
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

  // One QR opens the job on one device. Once a phone has claimed it, another
  // device holding the same link is turned away even if it knows the PIN.
  if (driverAccess.deviceBoundTo) {
    const deviceId = store.get(`${DRIVER_DEVICE_COOKIE_PREFIX}id`)?.value ?? "";
    if (!deviceId || hashDriverDeviceId(deviceId) !== driverAccess.deviceBoundTo) {
      return (
        <DriverNotice
          title="งานนี้เปิดใช้บนอุปกรณ์อื่นแล้ว"
          detail="เพื่อความปลอดภัย หนึ่ง QR ใช้ได้กับเครื่องเดียว หากต้องการย้ายเครื่อง กรุณาให้ศูนย์ควบคุมออก QR และรหัสใหม่"
        />
      );
    }
  }

  if (driverAccess.pinRequired) {
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
