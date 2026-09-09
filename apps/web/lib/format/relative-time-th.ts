// Thai relative-time label with second → minute → hour → day rollover.
// "45 วินาทีที่แล้ว" · "12 นาทีที่แล้ว" · "3 ชั่วโมงที่แล้ว" · "2 วันที่แล้ว"
//
// The one relative-time helper for the whole app. It used to have a twin in
// lib/ui/relative-time.ts that collapsed anything under a minute to
// "เมื่อสักครู่", so the same timestamp read differently on two cards of the
// same screen. This version accepts null/invalid input (→ "ยังไม่ระบุ") so the
// "last updated" callers that relied on the twin keep working.

type RelativeInput = string | number | Date | null | undefined;

function toMillis(from: RelativeInput): number | null {
  if (from === null || from === undefined || from === "") return null;
  const ms = from instanceof Date ? from.getTime() : new Date(from).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function formatRelativeTh(from: RelativeInput, now: number = Date.now()): string {
  const ms = toMillis(from);
  if (ms === null) return "ยังไม่ระบุ";

  const seconds = Math.round((now - ms) / 1000);
  if (seconds < 5) return "เมื่อสักครู่"; // covers just-now and clock-skewed future stamps
  if (seconds < 60) return `${seconds} วินาทีที่แล้ว`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days} วันที่แล้ว`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months} เดือนที่แล้ว`;

  return `${Math.round(months / 12)} ปีที่แล้ว`;
}

// Compact form for tight chips: "45 วิ" · "12 น." · "3 ชม." · "2 วัน"
export function formatRelativeCompactTh(from: RelativeInput, now: number = Date.now()): string {
  const ms = toMillis(from);
  if (ms === null) return "—";

  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  if (seconds < 60) return `${seconds} วิ`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} น.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ชม.`;
  return `${Math.round(hours / 24)} วัน`;
}
