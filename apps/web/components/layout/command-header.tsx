import { EnvironmentBadge } from "./environment-badge";

export function CommandHeader({ title = "ศูนย์ปฏิบัติการขนส่ง", subtitle = "ติดตามแผน ความพร้อม งานที่จัดสรร และความเสี่ยงแบบรวมศูนย์" }: { title?: string; subtitle?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white/85 p-4 shadow-soft backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-operation">TOMP Command Workspace</p>
          <h1 className="mt-1 text-xl font-semibold text-ink">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        <EnvironmentBadge />
      </div>
    </div>
  );
}
