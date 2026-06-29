import type { OperationalRiskLevel } from "@tomp/types/domain";

const labels: Record<OperationalRiskLevel, string> = {
  low: "ความเสี่ยงต่ำ",
  medium: "ความเสี่ยงปานกลาง",
  high: "ความเสี่ยงสูง"
};

export function RiskIndicator({ risk }: { risk: OperationalRiskLevel }) {
  return <span className="rounded-md border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700">{labels[risk]}</span>;
}
