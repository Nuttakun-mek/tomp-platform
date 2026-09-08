import { buildInfo } from "@/lib/build-info";

// Minimal version marker. Full build detail (commit, timezone) shows only outside
// production, where it is useful for debugging.
export function BuildVersionBadge({ compact = false }: { compact?: boolean }) {
  const isProduction = (process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV) === "production";
  const deployedCommit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? buildInfo.commit;

  if (compact || isProduction) {
    return <span className="text-[10px] font-medium text-slate-500">v{buildInfo.version}</span>;
  }

  return (
    <p className="text-[10px] leading-4 text-slate-500">
      v{buildInfo.version} · {deployedCommit} · {buildInfo.timezone}
    </p>
  );
}
