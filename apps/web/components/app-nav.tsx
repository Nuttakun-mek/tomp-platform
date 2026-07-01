"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SideNavSection } from "@/components/layout/side-nav-section";

const navSections = [
  {
    title: "ควบคุมปฏิบัติการ",
    items: [
      { href: "/", label: "ภาพรวม", description: "สถานะรวม" },
      { href: "/mission-control", label: "ศูนย์ควบคุม", description: "แผนที่และความเสี่ยง" },
      { href: "/live-test", label: "ทดสอบ GPS สด", description: "สร้างชุดทดสอบ" }
    ]
  },
  {
    title: "วางแผนและจัดสรร",
    items: [
      { href: "/projects", label: "โครงการ", description: "พื้นที่ปฏิบัติการ" },
      { href: "/assignments", label: "Assignment", description: "บอร์ดจัดสรรงาน" },
      { href: "/pilot-checklist", label: "ทดสอบ Pilot", description: "ขั้นตอนทดสอบ" }
    ]
  },
  {
    title: "เตรียมทรัพยากร",
    items: [
      { href: "/resources", label: "ทรัพยากร", description: "ภาพรวมความพร้อม" },
      { href: "/resources/drivers", label: "คนขับ", description: "ข้อมูลติดต่อและความพร้อม" },
      { href: "/resources/vehicles", label: "รถ", description: "ทะเบียน ประเภท ความจุ" }
    ]
  },
  {
    title: "การเข้าใช้งาน",
    items: [
      { href: "/driver", label: "หน้าคนขับ", description: "เข้าจาก QR" },
      { href: "/login", label: "เข้าสู่ระบบ", description: "เจ้าหน้าที่ปฏิบัติการ" },
      { href: "/admin", label: "ตั้งค่าระบบ", description: "สิทธิ์และผู้ใช้" }
    ]
  }
];

export function AppNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="grid gap-3">
      <button
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm lg:hidden"
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
                  className={`group rounded-md border px-3 py-2.5 transition ${
                    active
                      ? "border-operation bg-operation text-white shadow-command"
                      : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-white hover:text-operation hover:shadow-sm"
                  }`}
                >
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className={`mt-0.5 block text-xs ${active ? "text-teal-50" : "text-slate-500 group-hover:text-slate-600"}`}>
                    {item.description}
                  </span>
                </Link>
              );
            })}
          </SideNavSection>
        ))}
      </nav>
    </div>
  );
}
