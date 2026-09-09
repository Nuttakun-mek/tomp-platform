import { ChangeStatusBadge } from "@/components/change/change-status-badge";
import { getChangeRequestsByProjectId } from "@/lib/data/change-requests";
import { formatRelativeTh } from "@/lib/format/relative-time-th";

export async function ChangeRequestList({ projectId }: { projectId: string }) {
  const requests = await getChangeRequestsByProjectId(projectId);

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">คำขอเปลี่ยนแปลง</h2>
      {requests.length ? (
        <div className="mt-4 grid gap-3">
          {requests.map((item) => (
            <article key={item.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{item.reason}</p>
                <ChangeStatusBadge status={item.status} />
              </div>
              {item.impactSummary ? <p className="mt-1 text-sm text-slate-600">{item.impactSummary}</p> : null}
              <p className="mt-2 text-xs text-slate-400">
                {item.objectType} · ความรุนแรง {item.severity} · {formatRelativeTh(item.createdAt)}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          ยังไม่มีคำขอเปลี่ยนแปลงในโครงการนี้
        </p>
      )}
    </section>
  );
}
