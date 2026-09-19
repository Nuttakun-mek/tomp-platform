import { AirportTransferCaseCard } from "@/components/airport-transfer/case-card";
import { ProjectMissionBoard } from "@/components/projects/project-mission-board";
import { ProjectOperationSummaryPanel } from "@/components/projects/project-operation-summary";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import { combineResults } from "@/lib/data/data-result";
import { getAirportTransferCases, getAirportTransferTasksByCaseIds, getLatestAirportTransferFlightSnapshots } from "@/lib/airport-transfer/data";
import { getCallSignsByProjectId } from "@/lib/data/call-signs";
import { getLatestDriverLocationsByProjectId } from "@/lib/data/locations";
import { getMissionsByProjectId } from "@/lib/data/missions";
import { getProjectById } from "@/lib/data/projects";
import { getProjectDrivers, getProjectVehicles } from "@/lib/data/resources";
import { summariseProjectOperation } from "@/lib/domain/project-operation-summary";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";

// Renders a project helper straight into the same view their role already
// gets on the normal, signed-in side of the app — no new checklist/case UI.
// It cannot reuse those routes' own page components directly: the
// airport-transfer layout and every ground-transfer page resolve the viewer
// through getViewerAccess()/getCurrentUserProfile(), which requires a real
// Supabase Auth session, and a project helper authenticates only through the
// /helper/[token] PIN cookie (lib/project-helper/tokens.ts), never signs in.
// So this calls the same lib/data/* and lib/airport-transfer/data.ts readers
// and the same presentational components those pages render, directly.
async function resolveHelperMembership(projectId: string, profileId: string): Promise<{ systemKey: string; roleKey: string } | null> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("project_members")
    .select("system_key, roles(role_key)")
    .eq("project_id", projectId)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .maybeSingle();

  if (!data) return null;
  const roles = data.roles as { role_key?: string } | { role_key?: string }[] | null;
  const roleKey = Array.isArray(roles) ? roles[0]?.role_key : roles?.role_key;
  if (!roleKey) return null;
  return { systemKey: String(data.system_key), roleKey };
}

export async function ProjectHelperView({ projectId, profileId }: { projectId: string; profileId: string }) {
  const [project, membership] = await Promise.all([getProjectById(projectId), resolveHelperMembership(projectId, profileId)]);

  if (!project || !membership) {
    return (
      <div className="grid min-h-[70vh] content-center gap-2 text-center">
        <h1 className="text-lg font-bold text-ink">ไม่พบสิทธิ์การใช้งาน</h1>
        <p className="mx-auto max-w-sm text-[13px] leading-6 text-ink-soft">บทบาทนี้ถูกยกเลิกหรือย้ายออกจากโครงการแล้ว กรุณาติดต่อผู้จัดการโครงการ</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-4">
      <header className="grid gap-1">
        <p className="text-xs font-semibold text-operation">{project.projectCode}</p>
        <h1 className="text-xl font-bold text-ink">{project.projectName}</h1>
      </header>

      {membership.systemKey === "airport_transfer" ? (
        <AirportTransferHelperView projectId={projectId} projectCode={project.projectCode} />
      ) : (
        <GroundTransferHelperView projectId={projectId} />
      )}
    </div>
  );
}

async function AirportTransferHelperView({ projectId, projectCode }: { projectId: string; projectCode: string }) {
  const cases = await getAirportTransferCases({ projectId });
  const caseIds = cases.map((item) => item.id);
  const [snapshots, tasks] = await Promise.all([getLatestAirportTransferFlightSnapshots(caseIds), getAirportTransferTasksByCaseIds(caseIds)]);
  const activeCases = cases.filter((item) => !["completed", "cancelled"].includes(item.operationalStatus));

  if (!activeCases.length) {
    return <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-sm text-slate-500">ยังไม่มีงานที่กำลังดำเนินการ</p>;
  }

  return (
    <section className="grid gap-2">
      {activeCases.map((item) => (
        <AirportTransferCaseCard key={item.id} item={item} snapshot={snapshots[item.id]} tasks={tasks[item.id]} projectCode={projectCode} />
      ))}
    </section>
  );
}

async function GroundTransferHelperView({ projectId }: { projectId: string }) {
  const [missionsResult, callSignsResult, vehicles, drivers, locations] = await Promise.all([
    getMissionsByProjectId(projectId),
    getCallSignsByProjectId(projectId),
    getProjectVehicles(projectId),
    getProjectDrivers(projectId),
    getLatestDriverLocationsByProjectId(projectId)
  ]);

  const load = combineResults(missionsResult, callSignsResult);
  if (!load.ok) {
    return <DataUnavailable description="โหลดข้อมูลภาพรวมโครงการไม่สำเร็จ" detail={load.error} />;
  }

  const summary = summariseProjectOperation({
    vehicles,
    drivers,
    callSigns: callSignsResult.data,
    locations,
    now: Date.now()
  });

  return (
    <div className="grid gap-4">
      <ProjectOperationSummaryPanel summary={summary} />
      <ProjectMissionBoard missions={missionsResult.data} />
    </div>
  );
}
