import { ExceptionList } from "@/components/mission-control/exception-list";
import { FleetBoard } from "@/components/mission-control/fleet-board";
import { MapPlaceholder } from "@/components/mission-control/map-placeholder";
import { ReadinessBoard } from "@/components/mission-control/readiness-board";
import { TimelineFeed } from "@/components/mission-control/timeline-feed";
import { PageHeader } from "@/components/page-header";

export default function MissionControlPage() {
  return (
    <>
      <PageHeader
        eyebrow="Operate"
        title="Mission Control"
        description="Operations foundation without realtime. Timeline is treated as immutable operational memory."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <ReadinessBoard />
        <FleetBoard />
        <ExceptionList />
        <TimelineFeed />
      </div>
      <div className="mt-6">
        <MapPlaceholder />
      </div>
    </>
  );
}
