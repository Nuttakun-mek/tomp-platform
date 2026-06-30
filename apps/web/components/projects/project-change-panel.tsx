import { ChangeRequestForm } from "@/components/change/change-request-form";
import { ChangeRequestList } from "@/components/change/change-request-list";

export function ProjectChangePanel({ projectId }: { projectId: string }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-operation">Change Control</p>
      <h2 className="mt-1 text-lg font-semibold text-ink">คำขอเปลี่ยนแปลง</h2>
      <p className="mt-2 text-sm text-slate-600">หลังประกาศใช้แผน การเปลี่ยนแปลงต้องบันทึกเป็นคำขอและ Timeline</p>
      <div className="mt-4 grid gap-4">
        <ChangeRequestForm projectId={projectId} />
        <ChangeRequestList />
      </div>
    </section>
  );
}
