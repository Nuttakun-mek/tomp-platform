import { PilotRoleCard } from "@/components/pilot/pilot-role-card";
import { PilotScenarioBoard } from "@/components/pilot/pilot-scenario-board";
import { PilotStepper } from "@/components/pilot/pilot-stepper";
import { PilotTestResultPanel } from "@/components/pilot/pilot-test-result-panel";
import { getProjectIdWithLatestDriverLocation } from "@/lib/data/locations";
import { getProjects } from "@/lib/data/projects";
import { demoProject } from "@/lib/demo/demo-kernel";

export default async function PilotChecklistPage() {
  const [projects, latestLocationProjectId] = await Promise.all([getProjects(), getProjectIdWithLatestDriverLocation()]);
  const activeProject = projects.find((project) => project.id === latestLocationProjectId) ?? projects[0] ?? demoProject;
  const projectDetailHref = `/projects/${activeProject.id}`;
  const assignmentsHref = `/projects/${activeProject.id}/assignments`;

  const steps = [
    { title: "สร้างโครงการ", detail: "ตั้งชื่อ รหัส วันที่ และพื้นที่ปฏิบัติการ", href: "/projects/new" },
    { title: "เพิ่มภารกิจ", detail: "กำหนดจุดรับ จุดส่ง เวลา และข้อผูกพันด้านบริการ", href: projectDetailHref },
    { title: "จัดสรรรถและคนขับ", detail: "เชื่อมภารกิจ Call Sign คนขับ รถ และช่วงเวลา", href: assignmentsHref },
    { title: "สร้าง QR", detail: "สร้างลิงก์เข้าหน้างานสำหรับคนขับแบบ assignment-scoped", href: assignmentsHref },
    { title: "คนขับยืนยันความพร้อม", detail: "เปิดหน้าคนขับ ยืนยันข้อมูล และพร้อมเริ่มงาน", href: "/driver" },
    { title: "แชร์ GPS", detail: "คนขับกดเริ่มแชร์ตำแหน่งจาก web app", href: "/live-test" },
    { title: "ศูนย์ควบคุมติดตามสถานะ", detail: "ดูหมุด สีสัญญาณ ความเสี่ยง และรายการที่ต้องติดตาม", href: `/mission-control?projectId=${activeProject.id}` },
    { title: "ตรวจ Timeline", detail: "ยืนยันว่าลำดับเหตุการณ์สำคัญถูกบันทึก", href: `/mission-control?projectId=${activeProject.id}` },
    { title: "สรุปข้อสังเกต", detail: "บันทึกสิ่งที่ต้องแก้ก่อน pilot รอบถัดไป", href: "/pilot-checklist" }
  ];

  return (
    <>
      <PilotScenarioBoard projectCode={activeProject.projectCode} />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <PilotStepper steps={steps} />
        <aside className="grid content-start gap-4">
          <PilotRoleCard role="Operation Manager" responsibility="ดูภาพรวม ตัดสินใจเมื่อมีความเสี่ยง และยืนยันว่า flow พร้อมทดสอบ" />
          <PilotRoleCard role="Dispatcher" responsibility="จัดสรรภารกิจ คนขับ รถ Call Sign และ QR สำหรับคนขับ" />
          <PilotRoleCard role="Driver" responsibility="เปิด QR ยืนยันความพร้อม แชร์ GPS และอัปเดตสถานะงาน" />
          <PilotTestResultPanel />
        </aside>
      </div>
    </>
  );
}
