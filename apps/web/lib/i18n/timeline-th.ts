// Client-safe Thai labels for timeline event types. The raw event_type enum
// must never be shown to operators.

const TIMELINE_EVENT_LABELS_TH: Record<string, string> = {
  PROJECT_CREATED: "สร้างโครงการ",
  MISSION_CREATED: "สร้างภารกิจ",
  ASSIGNMENT_CREATED: "สร้างงานที่จัดสรร",
  DRIVER_CREATED: "เพิ่มคนขับ",
  VEHICLE_CREATED: "เพิ่มรถ",
  ASSIGNMENT_STATUS_CHANGED: "เปลี่ยนสถานะงาน",
  PROJECT_PUBLISHED: "ประกาศใช้แผนโครงการ",
  CHANGE_REQUEST_CREATED: "เปิดคำขอเปลี่ยนแปลง",
  CHANGE_REQUEST_APPROVED: "อนุมัติคำขอเปลี่ยนแปลง",
  CHANGE_REQUEST_APPLIED: "ใช้การเปลี่ยนแปลงแล้ว",
  CHANGE_REQUEST_REJECTED: "ปฏิเสธคำขอเปลี่ยนแปลง",
  DRIVER_CHECKED_IN: "คนขับเช็คอิน",
  VEHICLE_CHECKED_IN: "รถเช็คอิน",
  DRIVER_ISSUE_REPORTED: "คนขับแจ้งปัญหา",
  DRIVER_ACCESS_TOKEN_CREATED: "สร้างลิงก์ QR ให้คนขับ",
  DRIVER_ACCESS_TOKEN_REVOKED: "ยกเลิกลิงก์ QR",
  DRIVER_ACCESS_TOKEN_USED: "คนขับเปิดลิงก์ QR",
  DRIVER_LOCATION_SHARING_STARTED: "คนขับเริ่มแชร์ตำแหน่ง",
  DRIVER_LOCATION_SHARING_STOPPED: "คนขับหยุดแชร์ตำแหน่ง",
  DIRECT_EDIT_BLOCKED: "บล็อกการแก้ไขโดยตรง",
  ASSIGNMENT_CANCELLED: "ยกเลิกงานที่จัดสรร"
};

export function formatTimelineEventTh(eventType: string | null | undefined): string {
  if (!eventType) return "บันทึกเหตุการณ์";
  return (
    TIMELINE_EVENT_LABELS_TH[eventType] ??
    eventType
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}
