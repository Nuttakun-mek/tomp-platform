export function flightNumberHelpMessage(input: string) {
  const normalized = input.replace(/[\s-]+/g, "").toUpperCase();
  if (normalized.startsWith("ELAL")) return "ระบบจะค้นหา EL AL ด้วยรหัส LY เช่น ELAL82 จะถูกตรวจสอบเป็น LY82";
  return "กรุณาใช้รหัสเที่ยวบิน IATA เช่น TG931 หรือรหัส ICAO เช่น THA931";
}
