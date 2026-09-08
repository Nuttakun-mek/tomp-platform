// Pure decision helpers for scoped reads — no next/headers or client imports,
// so this stays unit-testable in the node test environment.

export function scopedReadsFlagOn(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.TOMP_SCOPED_READS || "").trim() === "1";
}

// Use the scoped (RLS-bound) client only when the flag is on AND a real auth
// session is present. Otherwise fall back to the service-role client.
export function shouldUseScopedClient(flagOn: boolean, hasSession: boolean): boolean {
  return flagOn && hasSession;
}
