import { EnvironmentBadge } from "./environment-badge";

export function CommandHeader({
  title = "ศูนย์ปฏิบัติการขนส่ง",
  subtitle = "ติดตามแผน ความพร้อม งานที่จัดสรร GPS และความเสี่ยงจากมุมมองเดียวกัน"
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="enterprise-panel overflow-hidden">
      <div className="enterprise-surface flex flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-6">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.2em] text-operation">TOMP COMMAND WORKSPACE</p>
          <h1 className="mt-1.5 text-2xl font-semibold leading-tight text-ink md:text-[28px]">{title}</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{subtitle}</p>
        </div>
        <EnvironmentBadge />
      </div>
    </section>
  );
}
