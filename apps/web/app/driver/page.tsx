import { PageHeader } from "@/components/page-header";

export default function DriverPage() {
  return (
    <>
      <PageHeader
        eyebrow="หน้าคนขับ"
        title="เข้าถึงงานด้วย QR"
        description="คนขับต้องเปิดลิงก์ที่สร้างจาก Assignment จริงเท่านั้น เพื่อให้ระบบตรวจ token และผูกตำแหน่งกับงานที่ได้รับมอบหมาย"
      />
      <section className="rounded-md border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-700 shadow-sm">
        ยังไม่มี Assignment ในหน้านี้ กรุณาเปิดลิงก์จาก QR ที่ศูนย์ควบคุมสร้างให้
      </section>
    </>
  );
}
