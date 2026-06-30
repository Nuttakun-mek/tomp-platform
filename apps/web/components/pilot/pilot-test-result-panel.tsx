export function PilotTestResultPanel() {
  return (
    <section className="rounded-md border border-amber-200 bg-amber-50 p-5 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">ผลที่ต้องยืนยัน</p>
      <h2 className="mt-1 text-lg font-semibold text-amber-950">เกณฑ์ผ่านสำหรับ Internal Pilot</h2>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-amber-900">
        <li>คนขับเปิด QR และเห็นงานของตัวเอง</li>
        <li>กดแชร์ GPS แล้ว Mission Control เห็นหมุดล่าสุด</li>
        <li>ศูนย์ควบคุมเห็น Call Sign คนขับ รถ และสถานะความสดของสัญญาณ</li>
        <li>Timeline มีบันทึกเหตุการณ์สำคัญโดยไม่มีปุ่มแก้ไขหรือลบ</li>
      </ul>
    </section>
  );
}
