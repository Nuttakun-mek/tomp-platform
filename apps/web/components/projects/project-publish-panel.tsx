import { PublishActionCard } from "@/components/publish/publish-action-card";
import type { PublishReadinessResult } from "@/lib/domain/publish-readiness";

export function ProjectPublishPanel({ projectId, readiness }: { projectId: string; readiness: PublishReadinessResult }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-operation">Publish</p>
      <h2 className="mt-1 text-lg font-semibold text-ink">ประกาศใช้แผน</h2>
      <p className="mt-2 text-sm text-slate-600">ก่อนประกาศใช้แผน ระบบจะตรวจ blocker สำคัญของโครงการ</p>
      <div className="mt-4">
        <PublishActionCard projectId={projectId} canPublish={readiness.canPublish} />
      </div>
    </section>
  );
}
