"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navSections = [
  {
    title: "งานปฏิบัติการ",
    items: [
      { href: "/", label: "ภาพรวม" },
      { href: "/mission-control", label: "ศูนย์ควบคุม" },
      { href: "/projects", label: "โครงการ" },
      { href: "/pilot-checklist", label: "ทดสอบ Pilot" }
    ]
  },
  {
    title: "ข้อมูลเตรียมงาน",
    items: [
      { href: "/resources", label: "ทรัพยากร" },
      { href: "/resources/drivers", label: "คนขับ" },
      { href: "/resources/vehicles", label: "รถ" }
    ]
  },
  {
    title: "ทางเข้าใช้งาน",
    items: [
      { href: "/driver", label: "หน้าคนขับ" },
      { href: "/login", label: "เข้าสู่ระบบ" }
    ]
  }
];

export function AppNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="grid gap-3">
      <button className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm lg:hidden" onClick={() => setOpen((current) => !current)} type="button">
        เมนู
      </button>
      <nav className={`${open ? "grid" : "hidden"} gap-5 lg:grid`} aria-label="เมนูหลัก">
        {navSections.map((section) => (
          <div key={section.title} className="grid gap-1">
            <p className="px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{section.title}</p>
            {section.items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-2.5 text-sm font-semibold transition ${
                    active ? "bg-operation text-white shadow-sm" : "text-slate-700 hover:bg-slate-100 hover:text-operation"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </div>
  );
}
