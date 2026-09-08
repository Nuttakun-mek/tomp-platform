import { EnvironmentBadge } from "./environment-badge";

export function CommandHeader({
  title = "ระบบบริหารจัดการการเดินทางและบริการ",
  subtitle = "ติดตามแผน ความพร้อม งานที่จัดสรร GPS และความเสี่ยงจากมุมมองเดียวกัน"
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="enterprise-panel overflow-hidden">
      <div className="enterprise-surface flex flex-wrap items-start justify-between gap-4 p-5 lg:p-6">
        <div className="min-w-0">
          <p className="section-label">Transportation Operations Management Platform</p>
          <h1 className="page-title mt-2">{title}</h1>
          <p className="page-description mt-2.5">{subtitle}</p>
        </div>
        <EnvironmentBadge />
      </div>
    </section>
  );
}
