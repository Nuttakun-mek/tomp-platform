import { ChangeImpactSummary } from "@/components/change/change-impact-summary";
import { ChangeStatusBadge } from "@/components/change/change-status-badge";

export function ChangeRequestDetail() {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-operation">รายละเอียดคำขอเปลี่ยนแปลง</p>
          <h3 className="mt-1 text-base font-semibold text-ink">ปรับ Assignment หลังประกาศใช้แผน</h3>
        </div>
        <ChangeStatusBadge status="requested" />
      </div>
      <div className="mt-4">
        <ChangeImpactSummary summary="ผู้ประสานงานต้องแจ้งคนขับและปรับกระดาน Call Sign ก่อนปล่อยรถ" severity="medium" />
      </div>
    </article>
  );
}
