"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SideNavSection } from "@/components/layout/side-nav-section";

const navSections = [
  {
    title: "ศูนย์ปฏิบัติการ",
    items: [
      { href: "/", label: "ภาพรวม", description: "สัญญาณรวมวันนี้" },
      { href: "/mission-control", label: "ศูนย์ควบคุม", description: "แผนที่ งาน และความเสี่ยง" },
      { href: "/live-test", label: "ทดสอบ GPS", description: "สร้างงานทดสอบเร็ว" }
    ]
  },
  {
    title: "วางแผนและจัดสรร",
    items: [
      { href: "/projects", label: "โครงการ", description: "พื้นที่ปฏิบัติการ" },
      { href: "/assignments", label: "Assignment", description: "บอร์ดจัดสรรงาน" },
      { href: "/pilot-checklist", label: "ทดสอบ Pilot", description: "ขั้นตอนตรวจระบบ" }
    ]
  },
  {
    title: "ทรัพยากร",
    items: [
      { href: "/resources", label: "ภาพรวมทรัพยากร", description: "ความพร้อมคนและรถ" },
      { href: "/resources/drivers", label: "คนขับ", description: "ข้อมูลติดต่อและสถานะ" },
      { href: "/resources/vehicles", label: "รถ", description: "ทะเบียน ประเภท ความจุ" }
    ]
  },
  {
    title: "ระบบ",
    items: [
      { href: "/driver", label: "หน้าคนขับ", description: "เข้าถึงงานด้วย QR" },
      { href: "/login", label: "เข้าสู่ระบบ", description: "เจ้าหน้าที่ปฏิบัติการ" },
      { href: "/admin", label: "ผู้ดูแลระบบ", description: "ตรวจระบบและ Pilot" }
    ]
  }
];

export function AppNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="grid gap-3">
      <button
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm lg:hidden"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {open ? "ปิดเมนู" : "เปิดเมนู"}
      </button>
      <nav className={`${open ? "grid" : "hidden"} gap-5 lg:grid`} aria-label="เมนูหลัก">
        {navSections.map((section) => (
          <SideNavSection key={section.title} title={section.title}>
            {section.items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group rounded-2xl border px-4 py-3 transition duration-200 ${
                    active
                      ? "border-teal-300/50 bg-teal-400/14 text-white shadow-command"
                      : "border-white/0 text-slate-300 hover:border-white/10 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className={`mt-1 block text-xs leading-5 ${active ? "text-teal-50" : "text-slate-500 group-hover:text-slate-300"}`}>{item.description}</span>
                </Link>
              );
            })}
          </SideNavSection>
        ))}
      </nav>
    </div>
  );
}
