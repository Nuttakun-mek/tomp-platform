import "server-only";

import { getPostgresClient } from "@/lib/db/postgres";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

// One QR is meant to drive one phone at a time. Since a driver can now move a
// job to a new handset by entering the PIN (see app/actions/driver-pin.ts), the
// binding moves — and everything the old phone is still holding has to stop
// working, or both devices report on the same job at once.
//
// Two credentials outlive the move on their own:
//
//   dsess                    a signed cookie, stateless, valid for 12 hours
//   driver_mobile_sessions   the native session row, valid until it expires
//
// Neither knows the binding changed. The signature on a dsess minted for the
// old device still verifies perfectly; that is exactly what a signature is for.
// So the device it was minted for is checked against the token's current
// binding on every call, and the old phone's native session rows are revoked
// the moment the job moves.

/**
 * The device currently holding this token, or null when the token is gone.
 * An empty string means the token exists but has never been claimed.
 */
export async function currentTokenDeviceHash(tokenId: string): Promise<string | null> {
  const { client } = getSupabaseWriteClient();
  if (client) {
    const { data, error } = await client
      .from("driver_access_tokens")
      .select("metadata, status")
      .eq("id", tokenId)
      .maybeSingle();
    if (error) return null;
    if (!data || data.status !== "active") return null;
    const meta = (data.metadata ?? {}) as Record<string, unknown>;
    return typeof meta.deviceHash === "string" ? meta.deviceHash : "";
  }

  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<Array<{ metadata: Record<string, unknown> | null; status: string }>>`
      select metadata, status from driver_access_tokens where id = ${tokenId} limit 1
    `;
    const row = rows[0];
    if (!row || row.status !== "active") return null;
    const hash = row.metadata?.deviceHash;
    return typeof hash === "string" ? hash : "";
  } catch {
    return null;
  }
}

/**
 * True when this session may still act on this token.
 *
 * A token nobody has claimed yet accepts any device — that is the first phone
 * arriving, before the binding is written. Once a device holds it, only that
 * device passes.
 */
export async function isSessionDeviceCurrent(tokenId: string, sessionDeviceHash: string): Promise<boolean> {
  const bound = await currentTokenDeviceHash(tokenId);
  // A lookup that failed must not lock a working driver out of their job: the
  // session's own signature and expiry already stand behind it.
  if (bound === null) return true;
  if (bound === "") return true;
  return bound === sessionDeviceHash;
}

/**
 * Revoke the native sessions of every device except the one that just claimed
 * the token. Called on re-bind so the previous phone stops posting GPS and
 * status updates for a job it no longer holds.
 */
export async function revokeMobileSessionsForOtherDevices(tokenId: string, keepDeviceHash: string): Promise<void> {
  const revokedAt = new Date().toISOString();

  const { client } = getSupabaseWriteClient();
  if (client) {
    await client
      .from("driver_mobile_sessions")
      .update({ status: "revoked", revoked_at: revokedAt, updated_at: revokedAt })
      .eq("token_id", tokenId)
      .neq("device_hash", keepDeviceHash)
      .is("revoked_at", null);
    return;
  }

  const sql = getPostgresClient();
  if (!sql) return;
  try {
    await sql`
      update driver_mobile_sessions
      set status = 'revoked', revoked_at = ${revokedAt}, updated_at = ${revokedAt}
      where token_id = ${tokenId} and device_hash <> ${keepDeviceHash} and revoked_at is null
    `;
  } catch {
    // The per-call device check below still turns the old phone away.
  }
}
