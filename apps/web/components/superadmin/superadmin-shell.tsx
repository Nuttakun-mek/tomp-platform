"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";

const TABS = [
  { href: "/superadmin", label: "ภาพรวม" },
  { href: "/superadmin/users", label: "ผู้ใช้และสิทธิ์" },
  { href: "/superadmin/roles", label: "บทบาท" },
  { href: "/superadmin/projects", label: "โครงการ" },
  { href: "/superadmin/audit", label: "บันทึกกิจกรรม" },
  { href: "/superadmin/dev-tools", label: "เครื่องมือพัฒนา" }
];

export function SuperadminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="grid gap-4" data-area="superadmin">
      <div className="flex items-center gap-3 rounded-panel border border-pilot/25 bg-pilot/10 px-4 py-2.5 text-sm font-semibold text-pilot">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        พื้นที่ภายในสำหรับทีมแพลตฟอร์มเท่านั้น
      </div>
      <nav className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => {
          const active = tab.href === "/superadmin" ? pathname === "/superadmin" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-panel px-3.5 py-1.5 text-[13px] font-semibold transition ${
                active ? "bg-command text-white" : "border border-border bg-white text-ink-soft hover:border-operation/40"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
