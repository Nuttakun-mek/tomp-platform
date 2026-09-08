// Pure decision helpers for scoped reads — no next/headers or client imports,
// so this stays unit-testable in the node test environment.

// Session-scoped reads (RLS-enforced) are ON by default. Set TOMP_SCOPED_READS=0
// to fall back to service-role reads (e.g. to debug an RLS policy).
export function scopedReadsFlagOn(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.TOMP_SCOPED_READS || "").trim() !== "0";
}

// Use the scoped (RLS-bound) client only when the flag is on AND a real auth
// session is present. Otherwise fall back to the service-role client.
export function shouldUseScopedClient(flagOn: boolean, hasSession: boolean): boolean {
  return flagOn && hasSession;
}
