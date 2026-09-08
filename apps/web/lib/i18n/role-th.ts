const ROLE_LABELS_TH: Record<string, string> = {
  super_admin: "ผู้ดูแลแพลตฟอร์ม",
  organization_admin: "ผู้ดูแลองค์กร",
  operation_manager: "ผู้จัดการปฏิบัติการ",
  project_manager: "ผู้จัดการโครงการ",
  planner: "ผู้วางแผน",
  dispatcher: "ผู้จัดสรรงาน",
  coordinator: "ผู้ประสานงาน",
  driver: "คนขับ",
  organizer: "ผู้จัดงาน",
  customer_viewer: "ผู้ชมฝั่งลูกค้า",
  vendor: "ผู้ให้บริการ"
};

export function roleLabelTh(roleKey: string | null | undefined): string {
  if (!roleKey) return "ยังไม่กำหนดบทบาท";
  return ROLE_LABELS_TH[roleKey] ?? roleKey;
}
