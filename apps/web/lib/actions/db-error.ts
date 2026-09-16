type DatabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string;
};

const uniqueFieldLabels: Record<string, string> = {
  projects_project_code_key: "รหัสโครงการ",
  missions_mission_code_key: "รหัสภารกิจ",
  call_signs_project_id_call_sign_key: "Call Sign",
  vehicles_plate_number_key: "ทะเบียนรถ",
  drivers_phone_key: "เบอร์โทรศัพท์คนขับ"
};

// Some unique constraints do not guard a field an operator could "change to
// another value" — they guard a slot that a live credential already occupies,
// and the way out is to reissue, not to retype. Telling someone to pick a
// different value is what made the passenger QR look simply broken: the button
// refused, and the reason it gave had nothing to do with the refusal.
const uniqueSlotMessages: Record<string, string> = {
  observer_access_tokens_one_active_per_call_sign_idx:
    "หน่วยรถนี้มีลิงก์ติดตามที่ยังใช้งานอยู่ กดออกลิงก์ใหม่เพื่อแทนที่ลิงก์เดิม",
  observer_access_tokens_one_active_per_project_idx:
    "โครงการนี้มีลิงก์ติดตามทั้งโครงการที่ยังใช้งานอยู่ กดออกลิงก์ใหม่เพื่อแทนที่ลิงก์เดิม",
  driver_access_tokens_one_active_per_call_sign_idx:
    "หน่วยรถนี้มี QR คนขับที่ยังใช้งานอยู่ กดออก QR ใหม่เพื่อแทนที่ใบเดิม"
};

export function getDatabaseErrorMessage(error: DatabaseErrorLike | null | undefined, fallback = "บันทึกข้อมูลไม่สำเร็จ") {
  const message = error?.message || "";
  const details = error?.details || "";
  const combined = `${message} ${details}`;

  if (error?.code === "23505" || combined.includes("duplicate key value")) {
    const slotKey = Object.keys(uniqueSlotMessages).find((key) => combined.includes(key));
    if (slotKey) return uniqueSlotMessages[slotKey];

    const matchedKey = Object.keys(uniqueFieldLabels).find((key) => combined.includes(key));
    const label = matchedKey ? uniqueFieldLabels[matchedKey] : "ข้อมูลนี้";
    return `${label} ถูกใช้แล้ว กรุณาเปลี่ยนเป็นค่าอื่น`;
  }

  if (error?.code === "23503" || combined.includes("violates foreign key constraint")) {
    return "ข้อมูลที่เลือกไม่สัมพันธ์กัน กรุณาตรวจสอบโครงการ ภารกิจ คนขับ หรือรถที่เลือก";
  }

  if (error?.code === "23502" || combined.includes("null value in column")) {
    return "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน";
  }

  if (message.toLowerCase().includes("fetch failed")) {
    return "เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาตรวจสอบการตั้งค่า Supabase และลองใหม่อีกครั้ง";
  }

  return fallback;
}
