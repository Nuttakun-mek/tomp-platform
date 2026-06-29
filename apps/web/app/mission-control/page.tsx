import { ExceptionList } from "@/components/mission-control/exception-list";
import { FleetBoard } from "@/components/mission-control/fleet-board";
import { MapPlaceholder } from "@/components/mission-control/map-placeholder";
import { ReadinessBoard } from "@/components/mission-control/readiness-board";
import { RealtimeStatusPanel } from "@/components/mission-control/realtime-status-panel";
import { TimelineFeed } from "@/components/mission-control/timeline-feed";
import { PageHeader } from "@/components/page-header";
import { demoProject } from "@/lib/demo/demo-kernel";
import { getTimelineEventsByProjectId } from "@/lib/data/timeline";

export default async function MissionControlPage() {
  const events = await getTimelineEventsByProjectId(demoProject.id);

  return (
    <>
      <PageHeader
        eyebrow="ศูนย์ควบคุมปฏิบัติการ"
        title="Mission Control สำหรับทีมปฏิบัติการ"
        description="หน้ารวมสถานะความพร้อม รถ คนขับ รายการที่ต้องติดตาม และ Timeline ที่แก้ไขย้อนหลังไม่ได้"
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <ReadinessBoard />
        <FleetBoard />
        <ExceptionList />
        <TimelineFeed events={events} />
      </div>
      <div className="mt-6">
        <MapPlaceholder />
      </div>
      <div className="mt-6">
        <RealtimeStatusPanel projectId={demoProject.id} />
      </div>
    </>
  );
}
