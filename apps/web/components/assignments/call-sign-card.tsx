import type { CallSign } from "@tomp/types/domain";

export function CallSignCard({ callSign }: { callSign?: CallSign }) {
  return (
    <div className="rounded-md bg-slate-950 px-3 py-2 text-white">
      <p className="text-[11px] font-semibold text-teal-200">Call Sign</p>
      <p className="text-lg font-semibold">{callSign?.callSign || "ยังไม่ระบุ"}</p>
    </div>
  );
}
