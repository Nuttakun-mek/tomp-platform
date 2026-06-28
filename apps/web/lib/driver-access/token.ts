export interface DriverAccessTokenDraft {
  assignmentId: string;
  driverId?: string | null;
  expiresAt?: string | null;
}

export function generateDriverAccessTokenPlaceholder(input: DriverAccessTokenDraft): string {
  // Sprint 7 placeholder only. Production token generation must be server-only and cryptographically secure.
  return `demo-${input.assignmentId}-${input.driverId ?? "pending"}`;
}

export async function hashDriverAccessTokenPlaceholder(token: string): Promise<string> {
  // Sprint 7 placeholder only. Replace with a server-only one-way hash before production use.
  return `placeholder-hash:${token}`;
}
