import Link from "next/link";
import { PermissionGate } from "@/components/auth/permission-gate";
import { PageHeader } from "@/components/page-header";

export default function AdminPage() {
  return (
    <PermissionGate anyRole={["super_admin"]}>
      <PageHeader
        eyebrow="ผู้ดูแลระบบ"
        title="ตั้งค่าระบบ"
        description="พื้นที่สำหรับตรวจสถานะระบบ สิทธิ์การเข้าถึง และเครื่องมือทดสอบสำหรับ internal pilot"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Link className="smart-card p-5" href="/admin/pilot-smoke-test">
          <p className="section-label">ทดสอบระบบจริง</p>
          <h2 className="card-title mt-1.5">ทดสอบแกนระบบจริง</h2>
          <p className="section-description mt-1.5">ตรวจ Supabase, สร้างชุดทดสอบ, เปิด QR คนขับ และดูผลใน Mission Control</p>
        </Link>
        <Link className="smart-card p-5" href="/admin/data-quality">
          <p className="section-label">คุณภาพข้อมูล</p>
          <h2 className="card-title mt-1.5">ตรวจคุณภาพข้อมูล Pilot</h2>
          <p className="section-description mt-1.5">ตรวจชื่อภาษาไทยเพี้ยน ข้อมูล Assignment/QR/GPS และความพร้อมก่อนให้ทีมทดสอบจริง</p>
        </Link>
        <Link className="smart-card p-5" href="/admin/enterprise-readiness">
          <p className="section-label">ความพร้อมองค์กร</p>
          <h2 className="card-title mt-1.5">ตรวจ 12 แกนระบบ</h2>
          <p className="section-description mt-1.5">ดูสิ่งที่พร้อมทดสอบ สิ่งที่ยังต้อง harden และขั้นถัดไปก่อน production จริง</p>
        </Link>
        <Link className="smart-card p-5" href="/admin/operations">
          <p className="section-label">ปฏิบัติการ</p>
          <h2 className="card-title mt-1.5">Runbook ดูแลระบบ</h2>
          <p className="section-description mt-1.5">ตรวจสุขภาพระบบ ทดสอบ GPS ตรวจข้อมูล และขั้นตอนรับมือเหตุผิดปกติ</p>
        </Link>
      </div>
    </PermissionGate>
  );
}
