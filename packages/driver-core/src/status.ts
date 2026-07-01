import type { DriverTaskStatus } from "@tomp/types/domain";

const statusThai: Record<DriverTaskStatus, string> = {
  assigned: "ได้รับงานแล้ว",
  acknowledged: "รับทราบงานแล้ว",
  ready: "พร้อมเริ่มงาน",
  en_route_pickup: "กำลังไปจุดรับ",
  arrived_pickup: "ถึงจุดรับแล้ว",
  passenger_onboard: "รับผู้โดยสารแล้ว",
  en_route_dropoff: "กำลังไปจุดส่ง",
  completed: "เสร็จสิ้นงาน",
  blocked: "ติดปัญหา",
  cancelled: "ยกเลิก"
};

const transitions: Record<DriverTaskStatus, DriverTaskStatus[]> = {
  assigned: ["acknowledged", "ready", "blocked", "cancelled"],
  acknowledged: ["ready", "blocked", "cancelled"],
  ready: ["en_route_pickup", "arrived_pickup", "blocked"],
  en_route_pickup: ["arrived_pickup", "blocked"],
  arrived_pickup: ["passenger_onboard", "blocked"],
  passenger_onboard: ["en_route_dropoff", "completed", "blocked"],
  en_route_dropoff: ["completed", "blocked"],
  completed: [],
  blocked: ["ready", "cancelled"],
  cancelled: []
};

export function mapDriverStatusToThai(status: DriverTaskStatus) {
  return statusThai[status] ?? "ยังไม่ระบุ";
}

export function getAllowedDriverStatusTransitions(status: DriverTaskStatus) {
  return transitions[status] ?? [];
}

export function canDriverStartTask(status: DriverTaskStatus) {
  return ["assigned", "acknowledged", "ready"].includes(status);
}

export function canDriverCompleteTask(status: DriverTaskStatus) {
  return ["passenger_onboard", "en_route_dropoff"].includes(status);
}
