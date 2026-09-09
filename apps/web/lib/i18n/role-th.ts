const ROLE_LABELS_TH: Record<string, string> = {
  super_admin: "ผู้ดูแลแพลตฟอร์ม",
  project_manager: "ผู้จัดการโครงการ",
  dispatcher: "ผู้จัดสรรงาน",
  coordinator: "ผู้ประสานงาน",
  customer_viewer: "ผู้ชมโครงการ",
  driver: "คนขับ"
};

export function roleLabelTh(roleKey: string | null | undefined): string {
  if (!roleKey) return "ยังไม่กำหนดบทบาท";
  return ROLE_LABELS_TH[roleKey] ?? roleKey;
}

/** สรุปสั้นๆ ว่าบทบาทนี้ทำอะไรได้ — ใช้บนหน้าบทบาทและสิทธิ์ */
const ROLE_SUMMARY_TH: Record<string, string> = {
  super_admin: "ทีมแพลตฟอร์ม เห็นและจัดการได้ทุกโครงการ รวมถึงผู้ใช้และเครื่องมือระบบ",
  project_manager: "เจ้าของโครงการ วางแผน สร้างภารกิจและงาน มอบหมายคนขับ และเผยแพร่แผน",
  dispatcher: "จัดสรรงานประจำวัน ออก QR ให้คนขับ และติดตามสถานะหน้างาน",
  coordinator: "ผู้ประสานงานหน้างาน ดูแผนและยืนยันสถานะ แต่แก้ไขแผนไม่ได้",
  customer_viewer: "ลูกค้า/ผู้จัดงาน ดูสถานะอย่างเดียว และส่งคำขอเปลี่ยนแปลงเข้ามา",
  driver: "เข้าผ่าน QR + รหัสเท่านั้น ไม่มีบัญชีเข้าระบบหลังบ้าน"
};

export function roleSummaryTh(roleKey: string): string {
  return ROLE_SUMMARY_TH[roleKey] ?? "ยังไม่ได้กำหนดคำอธิบายของบทบาทนี้";
}

const PERMISSION_LABELS_TH: Record<string, string> = {
  "project.read": "ดูโครงการ",
  "project.create": "สร้างโครงการ",
  "project.update": "แก้ไขโครงการ",
  "project.publish": "เผยแพร่แผน",
  "mission.read": "ดูภารกิจ",
  "mission.create": "สร้างภารกิจ",
  "assignment.read": "ดูงานที่มอบหมาย",
  "assignment.create": "สร้างงานและออก QR",
  "assignment.update": "อัปเดตงาน/สถานะ",
  "driver.read": "ดูข้อมูลคนขับ",
  "vehicle.read": "ดูข้อมูลรถ",
  "timeline.read": "ดูไทม์ไลน์",
  "change.create": "ส่งคำขอเปลี่ยนแปลง",
  "admin.manage_users": "จัดการผู้ใช้และบทบาท",
  "superadmin.access": "เข้าเครื่องมือระบบ"
};

export function permissionLabelTh(permission: string): string {
  return PERMISSION_LABELS_TH[permission] ?? permission;
}
