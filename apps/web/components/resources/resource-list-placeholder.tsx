import { StatusBadge } from "@/components/ui/status-badge";

interface ResourceListPlaceholderProps {
  title: string;
  items: Array<{ name: string; detail: string; status: string }>;
}

export function ResourceListPlaceholder({ title, items }: ResourceListPlaceholderProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">ข้อมูลตัวอย่างสำหรับตรวจหน้าทรัพยากร เมื่อเชื่อมต่อ Supabase แล้วจะแสดงข้อมูลจริง</p>
      </div>
      <div className="divide-y divide-slate-200">
        {items.map((item) => (
          <div key={item.name} className="grid gap-2 p-5 md:grid-cols-[1fr_auto]">
            <div>
              <h3 className="text-base font-semibold text-ink">{item.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
            </div>
            <StatusBadge label={item.status} tone="ready" />
          </div>
        ))}
      </div>
    </section>
  );
}
