import { ReadinessScoreCard } from "@/components/readiness/readiness-score-card";

export function ReadinessBoard({ assignmentCount, liveLocationCount }: { assignmentCount: number; liveLocationCount: number }) {
  const locationScore = assignmentCount ? Math.round((liveLocationCount / assignmentCount) * 100) : 0;

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <ReadinessScoreCard title="Assignment ที่มีตำแหน่งล่าสุด" score={locationScore} status={locationScore === 100 ? "ready" : "warning"} />
      <ReadinessScoreCard title="ตำแหน่งคนขับที่รับล่าสุด" score={liveLocationCount ? 100 : 0} status={liveLocationCount ? "ready" : "warning"} />
    </section>
  );
}
