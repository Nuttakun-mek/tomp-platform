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
      <div className="enterprise-surface flex flex-wrap items-center justify-between gap-4 p-5 lg:p-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-operation">TOMP COMMAND WORKSPACE</p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight text-ink md:text-3xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">{subtitle}</p>
        </div>
        <EnvironmentBadge />
      </div>
    </section>
  );
}
