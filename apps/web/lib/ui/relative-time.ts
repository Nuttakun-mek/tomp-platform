// Thai relative-time formatting for "last updated" style metadata.
// Pure — safe to use in server or client components and unit tests.

export function formatRelativeTh(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "ยังไม่ระบุ";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "ยังไม่ระบุ";

  const diffSeconds = Math.round((now - then) / 1000);
  if (diffSeconds < 0) return "เมื่อสักครู่";
  if (diffSeconds < 60) return "เมื่อสักครู่";

  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;

  const days = Math.floor(hours / 24);
  return `${days} วันที่แล้ว`;
}
