"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, CarFront, ClipboardList, FolderKanban, Gauge, LockKeyhole, MapPinned, Menu, Settings, UserRoundCheck, X } from "lucide-react";
import { SideNavSection } from "@/components/layout/side-nav-section";
import { Tooltip } from "@/components/ui/tooltip";

const navSections = [
  {
    title: "ใช้งานจริง",
    items: [
      { href: "/", label: "ภาพรวม", description: "สถานะรวมของงานวันนี้", icon: Gauge, help: "ดูจำนวนโครงการ งานที่จัดสรร สัญญาณ GPS และรายการที่ต้องติดตาม" },
      { href: "/mission-control", label: "ศูนย์ควบคุม", description: "แผนที่ งาน และความเสี่ยง", icon: MapPinned, help: "หน้าหลักสำหรับติดตามรถหลายคันและสัญญาณ GPS ล่าสุด" },
      { href: "/projects", label: "โครงการ", description: "สร้างและจัดการแผนงาน", icon: FolderKanban, help: "โครงการคือพื้นที่รวมภารกิจ งานที่จัดสรร คนขับ รถ และ Timeline" },
      { href: "/assignments", label: "บอร์ด Assignment", description: "มอบงานให้คนขับและรถ", icon: ClipboardList, help: "Assignment คืองานที่ผูก Call Sign คนขับ รถ เวลา และเส้นทาง" },
      { href: "/resources/vehicles", label: "จัดการรถ", description: "คิวงานและโปรไฟล์รถ", icon: CarFront, help: "ดูรถแต่ละคัน งานปัจจุบัน งานคงเหลือ งานที่เสร็จแล้ว และตำแหน่ง GPS ล่าสุด" },
      { href: "/driver", label: "หน้าคนขับ", description: "เปิดงานจาก QR", icon: UserRoundCheck, help: "สำหรับคนขับเปิดงาน ยืนยันความพร้อม และแชร์ GPS ตามงานที่ได้รับ" }
    ]
  },
  {
    title: "ทดสอบและดูแลระบบ",
    items: [
      { href: "/live-test", label: "ทดสอบระบบ", description: "ตรวจ QR และ GPS สด", icon: Activity, help: "ใช้เฉพาะทดสอบ Pilot: สร้างชุดข้อมูลจริง เปิด QR และดูตำแหน่งในศูนย์ควบคุม" },
      { href: "/login", label: "เข้าสู่ระบบ", description: "บัญชีและสิทธิ์ใช้งาน", icon: LockKeyhole, help: "เข้าสู่ระบบด้วยอีเมลหรือช่องทางที่เปิดไว้ใน Supabase Auth" },
      { href: "/admin", label: "ผู้ดูแลระบบ", description: "สุขภาพระบบและข้อมูล", icon: Settings, help: "ใช้ตรวจระบบ ฐานข้อมูล สิทธิ์ และ runbook สำหรับผู้ดูแล" }
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
      <nav className={`${open ? "grid" : "hidden"} gap-5 lg:grid`} aria-label="เมนูหลัก">
        {navSections.map((section) => (
          <SideNavSection key={section.title} title={section.title}>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Tooltip key={item.href} content={item.help} side="right" className="w-full">
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`group flex w-full gap-3 rounded-2xl border px-3 py-3 transition duration-200 ${
                      active
                        ? "border-teal-300/60 bg-teal-400/14 text-white shadow-command"
                        : "border-white/0 text-slate-300 hover:border-white/10 hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                        active ? "bg-teal-300/20 text-teal-100" : "bg-white/6 text-slate-400 group-hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold leading-5">{item.label}</span>
                      <span className={`mt-0.5 block text-[12px] leading-5 ${active ? "text-teal-50" : "text-slate-500 group-hover:text-slate-300"}`}>
                        {item.description}
                      </span>
                    </span>
                  </Link>
                </Tooltip>
              );
            })}
          </SideNavSection>
        ))}
      </nav>
    </div>
  );
}
