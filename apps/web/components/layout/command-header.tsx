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
          <p className="page-kicker">TOMP COMMAND WORKSPACE</p>
          <h1 className="mt-1.5 page-title">{title}</h1>
          <p className="mt-2 page-description">{subtitle}</p>
        </div>
        <EnvironmentBadge />
      </div>
    </section>
  );
}
