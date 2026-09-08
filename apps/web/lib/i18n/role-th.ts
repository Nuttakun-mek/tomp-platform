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
