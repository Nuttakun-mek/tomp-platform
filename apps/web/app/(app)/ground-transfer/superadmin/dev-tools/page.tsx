import Link from "next/link";
import { Activity, Apple, ClipboardList, DatabaseZap, Gauge, ListChecks, ServerCog, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";

type Tool = { href: string; label: string; detail: string; icon: typeof Activity };

// Used now: the review demo, clean-up, data checks and the live QR/GPS test.
const TOOLS: Tool[] = [
  { href: "/ground-transfer/superadmin/dev-tools/apple-review", label: "งานสาธิตสำหรับ Apple", detail: "QR ถาวรให้ผู้ตรวจ App Review", icon: Apple },
  { href: "/ground-transfer/superadmin/dev-tools/live-test", label: "ทดสอบ QR + GPS", detail: "เปิด QR คนขับและแชร์ GPS จบในหน้าเดียว", icon: Activity },
  { href: "/ground-transfer/superadmin/dev-tools/data-quality", label: "คุณภาพข้อมูล", detail: "ชื่อเพี้ยน งานไม่ครบ QR ที่ใช้ไม่ได้", icon: DatabaseZap },
  { href: "/ground-transfer/superadmin/dev-tools/purge-test-data", label: "ล้างข้อมูลทดสอบ", detail: "ลบข้อมูลที่เครื่องมือทดสอบสร้าง", icon: Trash2 }
];

// From the pilot: kept for reference, out of the way.
const PILOT_DOCS: Tool[] = [
  { href: "/ground-transfer/superadmin/dev-tools/smoke-test", label: "ตรวจ infrastructure", detail: "ตาราง Supabase และ Postgres", icon: ServerCog },
  { href: "/ground-transfer/superadmin/dev-tools/readiness", label: "ความพร้อม 12 แกน", detail: "สิ่งที่ต้อง harden ก่อน production", icon: Gauge },
  { href: "/ground-transfer/superadmin/dev-tools/runbook", label: "Runbook ดูแลระบบ", detail: "ตรวจสุขภาพและรับมือเหตุผิดปกติ", icon: ListChecks },
  { href: "/ground-transfer/superadmin/dev-tools/pilot-checklist", label: "Pilot checklist", detail: "ทดสอบ end-to-end ทีละบทบาท", icon: ClipboardList }
];

export default function DevToolsPage() {
  return (
    <>
      <PageHeader eyebrow="เครื่องมือ" title="เครื่องมือตรวจและทดสอบระบบ" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.href} tool={tool} />
        ))}
      </div>
      <details className="rounded-panel border border-border bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink-soft">เอกสารช่วงทดลองใช้ ({PILOT_DOCS.length})</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PILOT_DOCS.map((tool) => (
            <ToolCard key={tool.href} tool={tool} />
          ))}
        </div>
      </details>
    </>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon;
  return (
    <Link className="smart-card flex items-start gap-3 p-3.5" href={tool.href}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-panel bg-command text-white">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="card-title block">{tool.label}</span>
        <span className="section-description mt-0.5 block">{tool.detail}</span>
      </span>
    </Link>
  );
}
