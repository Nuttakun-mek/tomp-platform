import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getProjectIdWithLatestDriverLocation } from "@/lib/data/locations";
import { getProjects } from "@/lib/data/projects";
import { demoProject } from "@/lib/demo/demo-kernel";

export default async function PilotChecklistPage() {
  const [projects, latestLocationProjectId] = await Promise.all([getProjects(), getProjectIdWithLatestDriverLocation()]);
  const activeProject = projects.find((project) => project.id === latestLocationProjectId) ?? projects[0] ?? demoProject;
  const projectDetailHref = `/projects/${activeProject.id}`;
  const assignmentsHref = `/projects/${activeProject.id}/assignments`;

  const checklist = [
    {
      title: "ตั้งค่าโครงการ",
      detail: `เลือกหรือสร้างโครงการปฏิบัติการ ปัจจุบันใช้ ${activeProject.projectCode}`,
      href: "/projects"
    },
    {
      title: "เพิ่มภารกิจ",
      detail: "กำหนดภารกิจ จุดรับ จุดส่ง เวลา และข้อผูกพันด้านบริการ",
      href: projectDetailHref
    },
    {
      title: "จัดสรรรถและคนขับ",
      detail: "เชื่อมภารกิจ Call Sign รถ คนขับ และช่วงเวลาทำงาน",
      href: assignmentsHref
    },
    {
      title: "สร้าง QR สำหรับคนขับ",
      detail: "เปิดหน้า Assignment แล้วสร้างลิงก์ QR ที่ผูกกับ Assignment จริง",
      href: assignmentsHref
    },
    {
      title: "คนขับยืนยันความพร้อม",
      detail: "ให้คนขับเปิด QR ที่สร้างจริง ระบบจะพาไปหน้าคนขับพร้อม token",
      href: "/driver"
    },
    {
      title: "ศูนย์ควบคุมตรวจสถานะ",
      detail: "ติดตามตำแหน่ง GPS, ความพร้อม และ Timeline",
      href: `/mission-control?projectId=${activeProject.id}`
    },
    {
      title: "ตรวจ Timeline",
      detail: "ตรวจลำดับเหตุการณ์สำคัญโดยไม่มีปุ่มแก้ไขหรือลบ Timeline",
      href: `/mission-control?projectId=${activeProject.id}`
    }
  ];

  return (
    <>
      <PageHeader
        eyebrow="ทดสอบ Pilot"
        title="Checklist สำหรับทดสอบภายใน"
        description="เดิน flow จากข้อมูลจริง: โครงการ ภารกิจ Assignment QR คนขับ GPS และ Mission Control"
      />
      <section className="mb-6 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        ระบบเลือกโครงการทดสอบอัตโนมัติ: <span className="font-semibold">{activeProject.projectCode}</span> หากต้องการเปลี่ยนโครงการ ให้เริ่มจากหน้าโครงการหรือ Mission Control
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        {checklist.map((item, index) => (
          <Link key={item.title} href={item.href} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm hover:border-operation">
            <div className="flex items-start gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-operation text-sm font-semibold text-white">{index + 1}</span>
              <div>
                <h2 className="text-lg font-semibold text-ink">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
}
