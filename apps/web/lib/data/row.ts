// Shared helpers for turning a raw DB/Supabase row (Record<string, unknown>)
// into typed values. Keeps the many lib/data/* mappers from re-declaring these.

export type Row = Record<string, unknown>;

/** String value for `key`; Date is ISO-serialised; anything else → `fallback`. */
export function rowText(row: Row | null | undefined, key: string, fallback = ""): string {
  const value = row?.[key];
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : fallback;
}

/** Like {@link rowText} but coerces numbers/booleans to string too. */
export function rowLoose(row: Row | null | undefined, key: string, fallback = ""): string {
  const value = row?.[key];
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return value == null ? fallback : String(value);
}

export function rowNumber(row: Row | null | undefined, key: string, fallback = 0): number {
  const value = row?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

/** Plain object under `key`, or `{}` (arrays and non-objects excluded). */
export function rowObject(row: Row | null | undefined, key = "metadata"): Record<string, unknown> {
  const value = row?.[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
