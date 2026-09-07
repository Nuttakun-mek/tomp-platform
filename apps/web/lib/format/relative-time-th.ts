// Thai relative-time label with second → minute → hour → day rollover.
// "45 วินาทีที่แล้ว" · "12 นาทีที่แล้ว" · "3 ชั่วโมงที่แล้ว" · "2 วันที่แล้ว"

export function formatRelativeTh(fromIso: string | number | Date, now: number = Date.now()): string {
  const from = fromIso instanceof Date ? fromIso.getTime() : new Date(fromIso).getTime();
  if (Number.isNaN(from)) return "ไม่ทราบเวลา";

  const seconds = Math.max(0, Math.round((now - from) / 1000));
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
export function formatRelativeCompactTh(fromIso: string | number | Date, now: number = Date.now()): string {
  const from = fromIso instanceof Date ? fromIso.getTime() : new Date(fromIso).getTime();
  if (Number.isNaN(from)) return "—";

  const seconds = Math.max(0, Math.round((now - from) / 1000));
  if (seconds < 60) return `${seconds} วิ`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} น.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ชม.`;
  return `${Math.round(hours / 24)} วัน`;
}
