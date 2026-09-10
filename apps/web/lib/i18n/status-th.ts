const statusTh: Record<string, string> = {
  draft: "ร่าง",
  planning: "อยู่ระหว่างวางแผน",
  planned: "วางแผนแล้ว",
  published: "ประกาศใช้แผนแล้ว",
  ready: "พร้อม",
  active: "กำลังปฏิบัติงาน",
  operating: "กำลังปฏิบัติงาน",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิก",
  warning: "ต้องติดตาม",
  critical: "วิกฤต",
  blocked: "ติดเงื่อนไข",
  available: "พร้อมใช้งาน",
  assigned: "ถูกมอบหมายแล้ว",
  unavailable: "ไม่พร้อมใช้งาน",
  out_of_service: "ไม่พร้อมใช้งาน",
  inactive: "ไม่ใช้งาน",
  archived: "เก็บถาวร",
  pending: "รอดำเนินการ",
  acknowledged: "รับทราบแล้ว",
  arrived_pickup: "ถึงจุดรับแล้ว",
  passenger_onboard: "รับผู้โดยสารแล้ว",
  en_route_pickup: "กำลังไปจุดรับ",
  en_route_dropoff: "กำลังไปจุดส่ง",
  confirmed: "ยืนยันแล้ว",
  requested: "รอพิจารณา",
  approved: "อนุมัติแล้ว",
  rejected: "ปฏิเสธ",
  applied: "นำไปใช้แล้ว",
  live: "สด",
  slow: "สัญญาณช้า",
  offline: "ขาดการอัปเดต",
  stopped: "หยุดแชร์แล้ว"
};

export function formatStatusTh(status?: string | null): string {
  if (!status) return "ยังไม่ระบุ";
  if (status === "parked") return "พักงานไว้ชั่วคราว";
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
