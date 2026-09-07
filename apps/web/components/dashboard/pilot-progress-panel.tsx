const stages = [
  { name: "วางแผน", detail: "สร้างโครงการและภารกิจ" },
  { name: "เตรียมพร้อม", detail: "จัดรถ คนขับ และ QR" },
  { name: "ประกาศใช้แผน", detail: "ล็อกแผนและแจ้งทีม" },
  { name: "ปฏิบัติการ", detail: "ติดตาม GPS และ Timeline" },
  { name: "กู้คืนสถานการณ์", detail: "จัดการเหตุผิดปกติ" },
  { name: "ทบทวนผล", detail: "สรุปงานและบทเรียน" }
];

export function PilotProgressPanel() {
  return (
    <section className="enterprise-panel p-5">
      <p className="section-label">วงจรการดำเนินงาน</p>
      <h2 className="section-title mt-1">ลำดับการทำงานของ TOMP</h2>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stages.map((stage, index) => (
          <li key={stage.name} className="flex items-start gap-3 rounded-card border border-border/70 bg-canvas/50 p-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-operation text-[13px] font-semibold text-white">
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{stage.name}</span>
              <span className="mt-0.5 block text-xs text-ink-faint">{stage.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
