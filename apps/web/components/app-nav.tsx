"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, CarFront, ChevronRight, ClipboardList, FolderKanban, Gauge, LockKeyhole, MapPinned, Menu, Settings, UserRoundCheck, X } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

const navSections = [
  {
    title: "ใช้งานจริง",
    items: [
      { href: "/", label: "ภาพรวม", description: "สถานะรวมวันนี้", icon: Gauge, help: "ดูภาพรวมโครงการ งานที่จัดสรร GPS ล่าสุด และรายการที่ต้องติดตาม" },
      { href: "/mission-control", label: "ศูนย์ควบคุม", description: "แผนที่ รถ งาน ความเสี่ยง", icon: MapPinned, help: "ติดตามรถหลายคันบนแผนที่ ดูสถานะงาน GPS ข้อความจากคนขับ และรายการเสี่ยง" },
      { href: "/projects", label: "โครงการ", description: "สร้างและจัดการพื้นที่ปฏิบัติการ", icon: FolderKanban, help: "โครงการคือพื้นที่หลักสำหรับรวมภารกิจ งานที่จัดสรร คนขับ รถ QR และ Timeline" },
      { href: "/assignments", label: "บอร์ด Assignment", description: "มอบงานให้รถและคนขับ", icon: ClipboardList, help: "จัดสรรงานให้ Call Sign คนขับ และรถ พร้อมสร้าง QR เฉพาะงาน" },
      { href: "/resources/vehicles", label: "จัดการรถ", description: "โปรไฟล์รถและคิวงาน", icon: CarFront, help: "ดูรถแต่ละคัน งานปัจจุบัน งานคงเหลือ งานที่เสร็จแล้ว และ GPS ล่าสุด" },
      { href: "/driver", label: "หน้าคนขับ", description: "เปิดงานผ่าน QR", icon: UserRoundCheck, help: "หน้าสำหรับคนขับดูงาน ยืนยันความพร้อม แชร์ GPS และแจ้งปัญหา" }
    ]
  },
  {
    title: "ตรวจระบบ",
    items: [
      { href: "/live-test", label: "ทดสอบระบบ", description: "QR และ GPS สด", icon: Activity, help: "ใช้ทดสอบ flow แบบ end-to-end เท่านั้น แยกจากงานจริงเพื่อลดความสับสน" },
      { href: "/admin", label: "ผู้ดูแลระบบ", description: "สุขภาพระบบและข้อมูล", icon: Settings, help: "ตรวจฐานข้อมูล สิทธิ์ ข้อมูลผิดปกติ และ runbook สำหรับผู้ดูแล" },
      { href: "/login", label: "เข้าสู่ระบบ", description: "บัญชีและสิทธิ์", icon: LockKeyhole, help: "เข้าสู่ระบบด้วยบัญชีที่เปิดใช้งานไว้ใน Supabase Auth" }
    ]
  }
];

export function AppNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="grid gap-3">
      <button
        className="flex min-h-11 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm lg:hidden"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>เมนูระบบ</span>
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      <nav className={`${open ? "grid" : "hidden"} gap-5 lg:grid`} aria-label="เมนูหลัก">
        {navSections.map((section) => (
          <section key={section.title} className="grid gap-2">
            <p className="px-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 lg:text-slate-400">{section.title}</p>
            <div className="grid gap-1.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Tooltip key={item.href} content={item.help} side="right" className="w-full">
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`group flex w-full items-center gap-3 rounded-[18px] border px-3 py-3 transition duration-200 ${
                        active
                          ? "border-teal-300/60 bg-white text-ink shadow-[0_16px_34px_rgba(15,118,110,0.18)] lg:bg-white/95"
                          : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50 lg:bg-transparent lg:text-slate-300 lg:hover:border-white/10 lg:hover:bg-white/8 lg:hover:text-white"
                      }`}
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-[14px] ${
                          active ? "bg-operation text-white" : "bg-slate-100 text-slate-500 group-hover:text-operation lg:bg-white/8 lg:text-slate-400 lg:group-hover:text-white"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold leading-5">{item.label}</span>
                        <span className={`mt-0.5 block truncate text-[12px] leading-5 ${active ? "text-slate-600" : "text-slate-500 lg:text-slate-500 lg:group-hover:text-slate-300"}`}>
                          {item.description}
                        </span>
                      </span>
                      <ChevronRight className={`h-4 w-4 shrink-0 ${active ? "text-operation" : "text-slate-300 opacity-0 transition group-hover:opacity-100"}`} />
                    </Link>
                  </Tooltip>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </div>
  );
}
