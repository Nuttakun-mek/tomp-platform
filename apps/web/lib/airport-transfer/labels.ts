import type { AirportTransferOperationalStatus, AirportTransferVerificationStatus } from "./types";

export const operationalStatusLabel: Record<AirportTransferOperationalStatus, string> = {
  draft: "ร่าง",
  needs_review: "รอตรวจสอบ",
  verified: "ตรวจสอบแล้ว",
  ready_to_assign: "พร้อมจัดรถ",
  assigned: "จัดรถแล้ว",
  driver_notified: "แจ้งคนขับแล้ว",
  driver_confirmed: "คนขับยืนยันแล้ว",
  vehicle_en_route: "รถกำลังเดินทาง",
  vehicle_arrived: "รถถึงจุดรับ",
  passenger_met: "พบผู้โดยสารแล้ว",
  passenger_on_board: "รับผู้โดยสารแล้ว",
  en_route: "กำลังเดินทาง",
  arrived_destination: "ถึงปลายทาง",
  completed: "เสร็จสิ้น",
  issue: "มีปัญหา",
  cancelled: "ยกเลิก"
};

export const verificationStatusLabel: Record<AirportTransferVerificationStatus, string> = {
  pending: "รอตรวจเที่ยวบิน",
  verified: "เที่ยวบินถูกต้อง",
  partial_match: "ข้อมูลไม่ครบ",
  route_mismatch: "เส้นทางไม่ตรง",
  date_mismatch: "วันที่ไม่ตรง",
  multiple_matches: "พบหลายเที่ยวบิน",
  not_found: "ไม่พบเที่ยวบิน",
  manual_confirmed: "เจ้าหน้าที่ยืนยัน",
  needs_recheck: "ต้องตรวจใหม่",
  provider_unavailable: "ผู้ให้บริการไม่พร้อม"
};

