const statusTh: Record<string, string> = {
  draft: "ร่าง",
  planning: "อยู่ระหว่างวางแผน",
  published: "ประกาศใช้แผนแล้ว",
  ready: "พร้อม",
  active: "กำลังปฏิบัติงาน",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
  warning: "ต้องติดตาม",
  critical: "วิกฤต",
  available: "พร้อมใช้งาน",
  unavailable: "ไม่พร้อมใช้งาน",
  pending: "รอดำเนินการ",
  arrived_pickup: "ถึงจุดรับแล้ว",
  passenger_onboard: "รับผู้โดยสารแล้ว",
  confirmed: "ยืนยันแล้ว"
};

export function formatStatusTh(status?: string | null): string {
  if (!status) return "ไม่ระบุ";
  return statusTh[status] ?? status;
}

export function formatPriorityTh(priority?: string | null): string {
  const priorityTh: Record<string, string> = {
    low: "ต่ำ",
    normal: "ปกติ",
    high: "สูง",
    urgent: "เร่งด่วน",
    critical: "วิกฤต"
  };
  if (!priority) return "ปกติ";
  return priorityTh[priority] ?? priority;
}
