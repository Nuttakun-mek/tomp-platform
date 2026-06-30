import type { Mission } from "@tomp/types/domain";
import { MissionSummaryCard } from "@/components/missions/mission-summary-card";

export function ProjectMissionBoard({ missions }: { missions: Mission[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-operation">Missions</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">ภารกิจของโครงการ</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{missions.length} ภารกิจ</span>
      </div>
      <div className="mt-4 grid gap-3">
        {missions.length ? missions.map((mission) => <MissionSummaryCard key={mission.id} mission={mission} />) : <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">ยังไม่มีภารกิจในโครงการนี้</p>}
      </div>
    </section>
  );
}
