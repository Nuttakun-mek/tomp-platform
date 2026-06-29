import type { Project } from "@tomp/types/domain";
import { getEditMode } from "@/lib/domain/publish-state";

export function PublishedLockBanner({ project }: { project?: Project | null }) {
  const mode = getEditMode(project);

  if (mode === "draft_edit") {
    return (
      <section className="mb-6 rounded-md border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
        โหมดวางแผนยังเป็นร่าง สามารถแก้ไขข้อมูลได้จนกว่าจะประกาศใช้แผน
      </section>
    );
  }

  if (mode === "published_change_request") {
    return (
      <section className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        โครงการนี้ประกาศใช้แผนแล้ว การเปลี่ยนแปลงหลังจากนี้ต้องทำผ่านคำขอเปลี่ยนแปลงและบันทึกลง Timeline
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      โครงการนี้อยู่ในโหมดอ่านอย่างเดียว
    </section>
  );
}
