import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export default function ResourcesPage() {
  return (
    <>
      <PageHeader
        eyebrow="เตรียมความพร้อม"
        title="ทรัพยากร"
        description="จัดการข้อมูลคนขับ รถ และข้อมูลที่ใช้ประกอบการจัดสรรงานก่อนเริ่มปฏิบัติการ"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Link className="rounded-md border border-slate-200 bg-white p-5 shadow-sm hover:border-operation" href="/resources/drivers">
          <h2 className="text-lg font-semibold text-ink">คนขับ</h2>
          <p className="mt-2 text-sm text-slate-600">ข้อมูลคนขับ เบอร์ติดต่อ และสถานะความพร้อมสำหรับ Assignment</p>
        </Link>
        <Link className="rounded-md border border-slate-200 bg-white p-5 shadow-sm hover:border-operation" href="/resources/vehicles">
          <h2 className="text-lg font-semibold text-ink">รถ</h2>
          <p className="mt-2 text-sm text-slate-600">ข้อมูลรถ ประเภท ความจุ และสถานะการพร้อมใช้งาน</p>
        </Link>
      </div>
    </>
  );
}
