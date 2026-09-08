import { roleLabelTh } from "@/lib/i18n/role-th";
import { formatRelativeTh } from "./relative-time";

export interface OwnerLineInput {
  name?: string | null;
  roleKey?: string | null;
  at?: string | null;
  now?: number;
}

// "สมชาย · ผู้จัดสรรงาน · 5 นาทีที่แล้ว" — every operational object should carry
// a visible owner + role + last-touched time, never "floating".
export function formatOwnerLine({ name, roleKey, at, now }: OwnerLineInput): string {
  if (!name || !name.trim()) return "ยังไม่ระบุผู้รับผิดชอบ";
  const parts = [name.trim()];
  if (roleKey) parts.push(roleLabelTh(roleKey));
  if (at) parts.push(formatRelativeTh(at, now));
  return parts.join(" · ");
}
