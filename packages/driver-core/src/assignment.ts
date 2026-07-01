import { driverAssignmentPacketSchema } from "@tomp/types/schemas";
import type { DriverAssignmentPacket, DriverTaskStatus } from "@tomp/types/domain";
import { mapDriverStatusToThai } from "./status";

export function buildDriverAssignmentPacket(packet: DriverAssignmentPacket): DriverAssignmentPacket {
  return packet;
}

export function getCurrentDriverTask(packet: DriverAssignmentPacket) {
  return packet.instructions.find((instruction) => instruction.status !== "completed") ?? packet.instructions[0] ?? null;
}

export function getNextDriverAction(status: DriverTaskStatus) {
  const labels: Record<DriverTaskStatus, string> = {
    assigned: "กดรับทราบงาน",
    acknowledged: "ยืนยันความพร้อม",
    ready: "เริ่มเดินทางไปจุดรับ",
    en_route_pickup: "แจ้งเมื่อถึงจุดรับ",
    arrived_pickup: "แจ้งเมื่อรับผู้โดยสาร",
    passenger_onboard: "เดินทางไปจุดส่ง",
    en_route_dropoff: "แจ้งเมื่อเสร็จสิ้นงาน",
    completed: "งานเสร็จสิ้น",
    blocked: "ติดต่อศูนย์ควบคุม",
    cancelled: "งานถูกยกเลิก"
  };
  return labels[status] ?? mapDriverStatusToThai(status);
}

export function validateDriverAssignmentPacket(packet: unknown) {
  return driverAssignmentPacketSchema.safeParse(packet);
}
