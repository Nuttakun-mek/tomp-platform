export type MobileLocale = "th" | "en";

export const DEFAULT_MOBILE_LOCALE: MobileLocale = "th";

export function normalizeMobileLocale(value: unknown): MobileLocale {
  return value === "en" || value === "th" ? value : DEFAULT_MOBILE_LOCALE;
}

export const mobileCopy = {
  th: {
    ready: "พร้อมเปิดงาน",
    opening: "กำลังเปิดงาน",
    active: "กำลังใช้งาน",
    needsCheck: "ต้องตรวจสอบ",
    driverPage: "หน้าคนขับ",
    openWithQr: "เปิดงานด้วย QR",
    scanQr: "สแกน QR",
    closeCamera: "ปิดกล้อง",
    openJob: "เปิดงาน",
    logoutJob: "ออกจากงาน",
    reload: "รีเฟรช",
    systemStatus: "สถานะระบบ",
    pasteUrl: "หรือวาง URL/token จากศูนย์ควบคุม",
    scanInstruction: "สแกน QR หรือวาง URL งานที่ได้รับจากศูนย์ควบคุม"
  },
  en: {
    ready: "Ready",
    opening: "Opening",
    active: "Active",
    needsCheck: "Needs check",
    driverPage: "Driver page",
    openWithQr: "Open job with QR",
    scanQr: "Scan QR",
    closeCamera: "Close camera",
    openJob: "Open job",
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
