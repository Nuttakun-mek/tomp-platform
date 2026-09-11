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

/**
 * A phone is in one vehicle at a time, so it holds one unit at a time.
 *
 * The binding was checked per token — "does this device hold *this* unit" — and
 * nothing ever asked whether it already held a different one. So a device could
 * accumulate units: each page still opened, each kept its own PIN cookie, and
 * the driver saw two live jobs. Only one of them actually worked, because
 * `dsess` is a single cookie and the newer session overwrote the older, and
 * which one worked depended on the last page visited.
 *
 * Claiming a unit therefore releases this device from every other unit in the
 * project: the binding is cleared, the stale PIN cookie is dropped so the old
 * page shows the takeover gate immediately rather than a job that cannot act,
 * and any native session on that device is revoked.
 *
 * Releasing rather than refusing, because the common reason to scan a second QR
 * is a real vehicle change mid-shift. The released unit goes back to unclaimed,
 * which is where a unit sits before anyone scans it.
 */
export async function releaseDeviceFromOtherUnits(
  projectId: string,
  keepTokenId: string,
  deviceHash: string
): Promise<string[]> {
  if (!projectId || !deviceHash) return [];

  const { client } = getSupabaseWriteClient();
  if (!client) return [];

  const { data: others } = await client
    .from("driver_access_tokens")
    .select("id, metadata")
    .eq("project_id", projectId)
    .eq("status", "active")
    .neq("id", keepTokenId);

  const released: string[] = [];
  for (const row of others ?? []) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    if (meta.deviceHash !== deviceHash) continue;

    const next = { ...meta };
    delete next.deviceHash;
    await client.from("driver_access_tokens").update({ metadata: next }).eq("id", row.id);
    released.push(String(row.id));
  }

  if (released.length) {
    const revokedAt = new Date().toISOString();
    await client
      .from("driver_mobile_sessions")
      .update({ status: "revoked", revoked_at: revokedAt, updated_at: revokedAt })
      .in("token_id", released)
      .eq("device_hash", deviceHash)
      .is("revoked_at", null);
  }

  return released;
}
