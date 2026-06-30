export function PilotScenarioBoard({ projectCode }: { projectCode: string }) {
  return (
    <section className="rounded-md border border-slate-200 bg-slate-950 p-5 text-white shadow-command">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-200">Pilot Scenario</p>
      <h1 className="mt-1 text-2xl font-semibold">ทดสอบ end-to-end ด้วยโครงการ {projectCode}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-200">เป้าหมายคือพิสูจน์ว่าโครงการ ภารกิจ งานที่จัดสรร QR คนขับ GPS และ Mission Control เชื่อมกันครบใน flow เดียว</p>
    </section>
  );
}
