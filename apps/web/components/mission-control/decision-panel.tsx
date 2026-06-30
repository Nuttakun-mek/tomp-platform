import Link from "next/link";

export function DecisionPanel({ projectId, followUps }: { projectId: string; followUps: number }) {
  return (
    <section className="rounded-md border border-slate-200 bg-slate-950 p-5 text-white shadow-command">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-200">Decision Panel</p>
      <h2 className="mt-1 text-lg font-semibold">สิ่งที่ควรทำต่อ</h2>
      <div className="mt-4 grid gap-3">
        <Link className="rounded-md bg-white px-4 py-3 text-sm font-semibold text-slate-950" href={`/projects/${projectId}/assignments`}>
          ตรวจบอร์ด Assignment
        </Link>
        <Link className="rounded-md border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white" href="/live-test">
          สร้าง QR/GPS ทดสอบ
        </Link>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-300">
        {followUps > 0 ? `มี ${followUps} รายการที่ควรตรวจสอบก่อนเริ่มปฏิบัติการจริง` : "สถานะเบื้องต้นพร้อมสำหรับการติดตามใน Pilot"}
      </p>
    </section>
  );
}
