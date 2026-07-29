"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, ClipboardCheck, FolderKanban, Gauge, LockKeyhole, MapPinned, Menu, Route, Settings, Truck, UserRoundCheck, X } from "lucide-react";
import { SideNavSection } from "@/components/layout/side-nav-section";

const navSections = [
  {
    title: "ปฏิบัติการ",
    items: [
      { href: "/", label: "ภาพรวม", description: "สถานะรวมและตัวชี้วัดหลัก", icon: Gauge },
      { href: "/mission-control", label: "ศูนย์ควบคุม", description: "แผนที่ GPS งาน และความเสี่ยง", icon: MapPinned }
    ]
  },
  {
    title: "วางแผนและจัดสรร",
    items: [
      { href: "/projects", label: "โครงการ", description: "พื้นที่ปฏิบัติการและแผนงาน", icon: FolderKanban },
      { href: "/assignments", label: "บอร์ด Assignment", description: "Call Sign คนขับ และรถ", icon: Route },
      { href: "/resources", label: "ทรัพยากร", description: "ความพร้อมคนขับและรถ", icon: Truck }
    ]
  },
  {
    title: "การเข้าใช้งาน",
    items: [
      { href: "/login", label: "เข้าสู่ระบบ", description: "เจ้าหน้าที่และสิทธิ์การใช้งาน", icon: LockKeyhole },
      { href: "/driver", label: "หน้าคนขับ", description: "เปิดผ่าน QR ของงานเท่านั้น", icon: UserRoundCheck }
    ]
  },
  {
    title: "ทดสอบระบบ",
    items: [
      { href: "/live-test", label: "ทดสอบ QR และ GPS", description: "สร้างชุดทดสอบครบขั้นตอน", icon: Activity },
      { href: "/pilot-checklist", label: "คู่มือ Pilot", description: "ลำดับตรวจระบบภายใน", icon: ClipboardCheck },
      { href: "/admin", label: "ผู้ดูแลระบบ", description: "ตรวจ health และ runbook", icon: Settings }
    ]
  }
];

export function AppNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="grid gap-3">
      <button
        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm lg:hidden"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>เมนูระบบ</span>
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>
      <nav className={`${open ? "grid" : "hidden"} gap-4 lg:grid`} aria-label="เมนูหลัก">
        {navSections.map((section) => (
          <SideNavSection key={section.title} title={section.title}>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex gap-3 rounded-xl border px-3 py-2.5 transition duration-200 ${
                    active
                      ? "border-teal-300/60 bg-teal-400/14 text-white shadow-command"
                      : "border-white/0 text-slate-300 hover:border-white/10 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? "bg-teal-300/20 text-teal-100" : "bg-white/6 text-slate-400 group-hover:text-white"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-5">{item.label}</span>
                    <span className={`mt-0.5 block text-[12px] leading-5 ${active ? "text-teal-50" : "text-slate-500 group-hover:text-slate-300"}`}>
                      {item.description}
                    </span>
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
