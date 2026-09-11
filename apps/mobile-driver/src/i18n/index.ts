export type MobileLocale = "th" | "en";

export const DEFAULT_MOBILE_LOCALE: MobileLocale = "th";

export function normalizeMobileLocale(value: unknown): MobileLocale {
  return value === "en" || value === "th" ? value : DEFAULT_MOBILE_LOCALE;
}

export const mobileCopy = {
  th: {
    ready: "รอรับงาน",
    opening: "กำลังเปิดข้อมูล",
    active: "อยู่ระหว่างปฏิบัติงาน",
    needsCheck: "ต้องตรวจสอบ",
    driverPage: "หน้าคนขับ",
    openWithQr: "รับงานผ่าน QR",
    scanQr: "สแกน QR รับงาน",
    closeCamera: "ปิดกล้อง",
    openJob: "เปิดงาน",
    manualEntry: "กรอกลิงก์ด้วยตนเอง",
    hideManualEntry: "ซ่อนช่องกรอกลิงก์",
    logoutJob: "ออกจากงาน",
    reload: "รีเฟรช",
    systemStatus: "สถานะระบบ",
    pasteUrl: "วาง URL/token จากศูนย์ควบคุม",
    scanInstruction: "สแกน QR งานที่ได้รับจากศูนย์ควบคุม"
  },
  en: {
    ready: "Ready",
    opening: "Opening",
    active: "Active",
    needsCheck: "Needs check",
    driverPage: "Driver page",
    openWithQr: "Open job with QR",
    scanQr: "Scan job QR",
    closeCamera: "Close camera",
    openJob: "Open job",
    manualEntry: "Enter link manually",
    hideManualEntry: "Hide manual entry",
    logoutJob: "Leave job",
    reload: "Reload",
    systemStatus: "System status",
    pasteUrl: "Or paste the URL/token from Mission Control",
    scanInstruction: "Scan the QR or paste the job URL from Mission Control"
  }
} as const;

export function mt(locale: MobileLocale, key: keyof (typeof mobileCopy)["th"]) {
  return mobileCopy[locale]?.[key] ?? mobileCopy.th[key];
}
