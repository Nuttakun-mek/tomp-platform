import type { Mission } from "@tomp/types/domain";
import { MissionSummaryCard } from "./mission-summary-card";

export function MissionListPlaceholder({ missions }: { missions: Mission[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-lg font-semibold text-ink">Mission List</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Placeholder mission section inside the project detail foundation.</p>
      </div>
      <div className="divide-y divide-slate-200">
        {missions.map((mission) => <div key={mission.id} className="p-3"><MissionSummaryCard mission={mission} /></div>)}
      </div>
    </section>
  );
}
