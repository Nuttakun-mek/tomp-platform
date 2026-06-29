import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { PageSection } from "@/components/ui/page-section";

const operatingCycleTh = [
  { key: "Plan", label: "วางแผน", detail: "จัดโครงสร้างโครงการ ภารกิจ ทรัพยากร และเวลาปฏิบัติงาน" },
  { key: "Prepare", label: "เตรียมความพร้อม", detail: "ตรวจความพร้อมคนขับ รถ Call Sign และข้อมูลติดต่อ" },
  { key: "Publish", label: "ประกาศใช้แผน", detail: "ตรึงแผนเป็น baseline ก่อนเริ่มปฏิบัติการ" },
  { key: "Operate", label: "ปฏิบัติการ", detail: "ติดตามสถานะ Assignment และการตัดสินใจหน้างาน" },
  { key: "Recover", label: "กู้คืนสถานการณ์", detail: "จัดการเหตุผิดปกติและบันทึกการแก้ไขอย่างเป็นระบบ" },
  { key: "Review", label: "ทบทวนผล", detail: "ใช้ Timeline และข้อมูลปฏิบัติการเพื่อปรับปรุงรอบถัดไป" }
];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="ภาพรวมการปฏิบัติการ"
        title="ภาพรวม"
        description="พื้นที่ทำงานสำหรับทดสอบภายใน ครอบคลุมการวางแผน ความพร้อม การจัดสรรงาน การประสานคนขับ และการตรวจ Timeline"
      />
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="สถานะระบบ" value="Internal Pilot" detail="พร้อมสำหรับการทดสอบแบบมีผู้ดูแล" />
        <StatCard label="วงจรการดำเนินงาน" value="6 ขั้นตอน" detail="ตั้งแต่วางแผนจนถึงทบทวนผล" />
        <StatCard label="กฎ Timeline" value="แก้ไขย้อนหลังไม่ได้" detail="ไม่มีปุ่มแก้ไขหรือลบเหตุการณ์" />
      </section>
      <div className="mt-8">
        <PageSection title="วงจรการดำเนินงาน" description="TOMP ช่วยให้ทีมปฏิบัติการเดินงานขนส่งของอีเวนต์ตามลำดับที่ควบคุมได้">
          <section className="grid gap-4 md:grid-cols-3">
            {operatingCycleTh.map((stage) => (
              <div key={stage.key} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-operation">{stage.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{stage.detail}</p>
              </div>
            ))}
          </section>
        </PageSection>
      </div>
    </>
  );
}
