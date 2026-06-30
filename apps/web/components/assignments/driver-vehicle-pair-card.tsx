import type { Driver, Vehicle } from "@tomp/types/domain";

export function DriverVehiclePairCard({ driver, vehicle }: { driver?: Driver; vehicle?: Vehicle }) {
  return (
    <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
      <div>
        <p className="text-xs font-semibold text-slate-500">คนขับ</p>
        <p className="font-semibold text-ink">{driver?.fullName || "ยังไม่ระบุ"}</p>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500">รถ</p>
        <p className="font-semibold text-ink">{vehicle?.plateNumber || "ยังไม่ระบุ"}</p>
      </div>
    </div>
  );
}
