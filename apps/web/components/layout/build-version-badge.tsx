import { buildInfo } from "@/lib/build-info";

export function BuildVersionBadge() {
  const deployedCommit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? buildInfo.commit;

  return (
    <div className="rounded-md border border-white/10 bg-slate-900/85 px-3 py-2 text-xs text-slate-300">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-slate-100">อัปเดตล่าสุด</span>
        <span className="rounded-full bg-teal-400/15 px-2 py-0.5 font-semibold text-teal-100">v{buildInfo.version}</span>
      </div>
      <div className="mt-1 leading-5">
        <p>{buildInfo.updatedAtText}</p>
        <p className="text-slate-500">
          commit {deployedCommit} · {buildInfo.timezone}
        </p>
      </div>
    </div>
  );
}
