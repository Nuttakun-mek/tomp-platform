import { withTimeout } from "@/lib/async/timeout";

// A read either succeeded (`ok`) or failed. Either way it carries `data` — a
// safe empty fallback on failure — so a server component can always render.
// `ok: false` is what lets a page show an honest "ข้อมูลไม่พร้อมใช้งาน / ลองใหม่"
// surface instead of a fabricated or silently-empty list (957 P0-3).
export type DataResult<T> =
  | { ok: true; data: T }
  | { ok: false; data: T; error: string };

export function dataOk<T>(data: T): DataResult<T> {
  return { ok: true, data };
}

export function dataFail<T>(fallback: T, error: string): DataResult<T> {
  return { ok: false, data: fallback, error };
}

type SupabaseQuery = PromiseLike<{ data: unknown; error: unknown }>;

// Run a Supabase list query behind the shared timeout and normalise the outcome:
//   - transport/timeout throw  → ok:false
//   - PostgREST error          → ok:false
//   - non-array payload        → ok:true with the empty fallback (no rows)
//   - rows                     → ok:true with map(rows)
export async function runListQuery<T>(opts: {
  fallback: T;
  label: string;
  timeoutMs?: number;
  query: () => SupabaseQuery;
  map: (rows: Record<string, unknown>[]) => T;
}): Promise<DataResult<T>> {
  try {
    const { data, error } = await withTimeout(opts.query(), opts.timeoutMs ?? 2200, opts.label);
    if (error) {
      const message = (error as { message?: string })?.message || "query failed";
      return dataFail(opts.fallback, `${opts.label}: ${message}`);
    }
    if (!Array.isArray(data)) return dataOk(opts.fallback);
    return dataOk(opts.map(data as Record<string, unknown>[]));
  } catch (error) {
    return dataFail(opts.fallback, error instanceof Error ? error.message : `${opts.label}: read failed`);
  }
}

// Combine several results: ok only if every part is ok; the first error otherwise.
export function combineResults(...results: DataResult<unknown>[]): { ok: boolean; error?: string } {
  const failed = results.find((result) => !result.ok) as { error: string } | undefined;
  return failed ? { ok: false, error: failed.error } : { ok: true };
}
