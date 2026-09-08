import type { CSSProperties } from "react";
import { OperationsHero } from "@/components/dashboard/operations-hero";
import { OperationsPulse } from "@/components/dashboard/operations-pulse";
import { QuickActionPanel } from "@/components/dashboard/quick-action-panel";
import { ReadinessOverview } from "@/components/dashboard/readiness-overview";
import { TodayOperationBoard } from "@/components/dashboard/today-operation-board";
import { CommandHeader } from "@/components/layout/command-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getViewerAccess } from "@/lib/auth/access";
import { getAssignmentsByProjectId } from "@/lib/data/assignments";
import { getLatestDriverLocations } from "@/lib/data/locations";
import { getProjects } from "@/lib/data/projects";
import { getTimelineEventsByProjectId } from "@/lib/data/timeline";

export default async function DashboardPage() {
  const { permissions, roleKeys } = await getViewerAccess();
  const can = (permission: string) => permissions.includes("*") || permissions.includes(permission);
  const canSeeAssignments = can("assignment.read");
  const canSeeDrivers = can("driver.read");
  const canSeeProjects = can("project.read");
  const isSuperAdmin = roleKeys.includes("super_admin");

  const projects = canSeeProjects ? await getProjects() : [];
  const primaryProjectId = projects[0]?.id;

  const [assignments, locations, events] = await Promise.all([
    canSeeAssignments && primaryProjectId ? getAssignmentsByProjectId(primaryProjectId) : Promise.resolve([]),
    canSeeDrivers ? getLatestDriverLocations(10) : Promise.resolve([]),
    canSeeProjects && primaryProjectId ? getTimelineEventsByProjectId(primaryProjectId) : Promise.resolve([])
  ]);

  const activeAssignments = assignments.filter((assignment) => ["active", "ready", "in_progress"].includes(assignment.status)).length;
  const completedAssignments = assignments.filter((assignment) => assignment.status === "completed").length;
  const followUpCount = assignments.filter((assignment) => !assignment.driverId || !assignment.vehicleId || !assignment.callSignId).length;
  const riskCount = locations.filter((location) => Date.now() - new Date(location.recordedAt).getTime() > 120000).length;
  const readinessScore = assignments.length ? Math.min(100, Math.round((locations.length / assignments.length) * 100)) : locations.length ? 100 : 0;

  if (!canSeeAssignments && !canSeeDrivers && !canSeeProjects && !isSuperAdmin) {
    return (
      <>
        <CommandHeader title="ภาพรวมการปฏิบัติการ" subtitle="ยินดีต้อนรับสู่ TOMP" />
        <EmptyState
          title="ยังไม่มีพื้นที่ทำงานที่กำหนดให้บัญชีนี้"
          description="ติดต่อผู้ดูแลระบบเพื่อรับบทบาทและสิทธิ์เข้าใช้งานพื้นที่ทำงานที่เกี่ยวข้อง"
        />
      </>
    );
  }

  return (
    <>
      <CommandHeader
        title="ภาพรวมการปฏิบัติการ"
        subtitle="หน้าหลักสำหรับเห็นโครงการ งานที่จัดสรร ความพร้อมของคนขับและรถ สัญญาณ GPS และรายการที่ต้องตัดสินใจ"
      />

      <OperationsHero
        projectCount={projects.length}
        assignmentCount={assignments.length}
        gpsCount={locations.length}
        followUpCount={followUpCount + riskCount}
      />

      <div className="page-grid" style={{ "--rail": "360px" } as CSSProperties}>
        <div className="page-main">
          {canSeeAssignments ? (
            <>
              <OperationsPulse
                ready={Math.max(0, assignments.length - followUpCount - activeAssignments - completedAssignments)}
                followUp={followUpCount}
                risk={riskCount}
                active={activeAssignments}
                completed={completedAssignments}
              />
              <TodayOperationBoard projects={projects} latestLocation={locations[0]} latestEvent={events[0]} />
            </>
          ) : (
            <EmptyState
              title="บัญชีนี้ยังไม่เห็นงานที่จัดสรร"
              description="เมื่อได้รับสิทธิ์ในโครงการ รายการงานและบอร์ดปฏิบัติการจะแสดงที่นี่"
            />
          )}
        </div>
        <div className="page-rail">
          {canSeeProjects ? (
            <ReadinessOverview score={readinessScore} gpsCount={locations.length} assignmentCount={assignments.length} />
          ) : null}
          <QuickActionPanel />
        </div>
      </div>

    </>
  );
}
