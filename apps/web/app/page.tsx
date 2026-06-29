import { PageHeader } from "@/components/page-header";
import { PageSection } from "@/components/ui/page-section";
import { StatCard } from "@/components/ui/stat-card";

const operatingCycle = [
  { label: "วางแผน", detail: "สร้างโครงการ ภารกิจ ทรัพยากร และช่วงเวลาปฏิบัติการ" },
  { label: "เตรียมความพร้อม", detail: "ตรวจคนขับ รถ Call Sign เบอร์ติดต่อ และหลักฐานก่อนเริ่มงาน" },
  { label: "ประกาศใช้แผน", detail: "ตรึงแผนเป็น baseline และบันทึกลง Timeline" },
  { label: "ปฏิบัติการ", detail: "ติดตาม Assignment สถานะคนขับ และรายการที่ต้องตัดสินใจ" },
  { label: "กู้คืนสถานการณ์", detail: "จัดการเหตุผิดปกติอย่างมีขั้นตอนและมีบันทึกตรวจสอบได้" },
  { label: "ทบทวนผล", detail: "ใช้ Timeline และข้อมูลปฏิบัติการเพื่อปรับปรุงงานรอบถัดไป" }
];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="ภาพรวมการปฏิบัติการ"
        title="ศูนย์รวมงานขนส่งของ TOMP"
        description="พื้นที่ทำงานสำหรับ Pilot ภายใน ครอบคลุมการวางแผน จัดสรรงาน ตรวจความพร้อม คนขับ ศูนย์ควบคุม และ Timeline"
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="สถานะระบบ" value="Internal Pilot" detail="พร้อมสำหรับการทดสอบแบบมีผู้ดูแล" />
        <StatCard label="เส้นทาง Pilot" value="7 ขั้นตอน" detail="ตั้งค่าโครงการจนถึงตรวจ Timeline" />
        <StatCard label="กฎ Timeline" value="แก้ย้อนหลังไม่ได้" detail="ไม่มีปุ่มแก้ไขหรือลบเหตุการณ์" />
      </section>

      <section className="mt-8 rounded-md border border-slate-200 bg-white p-6 shadow-soft">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-operation">เริ่มทดสอบจากข้อมูลตัวอย่าง</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">เดิน flow ปฏิบัติการให้ครบก่อนเปิด Pilot จริง</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              เริ่มจากโครงการ เพิ่มภารกิจ จัดสรรรถและคนขับ ส่ง QR ให้คนขับ แล้วตรวจสถานะในศูนย์ควบคุมปฏิบัติการ
            </p>
          </div>
          <div className="grid gap-3 rounded-md bg-slate-50 p-4">
            {["โครงการ", "ภารกิจ", "Assignment", "QR คนขับ", "Mission Control"].map((item) => (
              <div key={item} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                <span>{item}</span>
                <span className="text-operation">พร้อมทดสอบ</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-8">
        <PageSection title="วงจรการดำเนินงาน" description="TOMP ช่วยให้ทีมปฏิบัติการขนส่งเดินงานตามขั้นตอนเดียวกัน ลดการสื่อสารกระจัดกระจาย และบันทึกการตัดสินใจสำคัญไว้ใน Timeline">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {operatingCycle.map((stage) => (
              <article key={stage.label} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-base font-semibold text-operation">{stage.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{stage.detail}</p>
              </article>
            ))}
          </section>
        </PageSection>
      </div>
    </>
  );
}
