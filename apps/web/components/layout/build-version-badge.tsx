import { buildInfo } from "@/lib/build-info";

function formatBuildTime(): string {
  const iso = process.env.NEXT_PUBLIC_BUILD_TIME;
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return buildInfo.updatedAtText;
  return date.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Version marker: deploy date + time (Bangkok) so it is obvious how fresh the
// running build is; commit sha shows outside production for debugging.
export function BuildVersionBadge({ compact = false }: { compact?: boolean }) {
  const isProduction = (process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV) === "production";
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA || buildInfo.commit;
  const stamp = formatBuildTime();

  if (compact) {
    return <span className="text-[10px] font-medium text-slate-500">{stamp}</span>;
  }

  return (
    <p className="text-[10px] leading-4 text-slate-500">
      อัปเดตล่าสุด {stamp} น.
      {!isProduction && sha !== "local" ? <> · {sha}</> : null}
    </p>
  );
}
