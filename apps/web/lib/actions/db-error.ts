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

export function getDatabaseErrorMessage(error: DatabaseErrorLike | null | undefined, fallback = "บันทึกข้อมูลไม่สำเร็จ") {
  const message = error?.message || "";
  const details = error?.details || "";
  const combined = `${message} ${details}`;

  if (error?.code === "23505" || combined.includes("duplicate key value")) {
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

  return fallback;
}
