import "server-only";

import { randomBytes, createHash, timingSafeEqual } from "crypto";
import { readCleanEnv } from "@/lib/env";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

// The raw token itself has 128 bits of entropy (randomBytes(16)) and is only
// ever used as a lookup key, not a secret someone is expected to guess, so an
// unsalted/unpeppered hash is fine for it — this is the same reasoning
// lib/driver-access/token.ts applies to hashDriverAccessToken.
function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// The PIN is a different story: 4-6 digits is a tiny space (as few as 10,000
// possibilities), and it is meant to be read aloud/typed by a human, not
// treated as high-entropy. Hashing it the same bare way as the token would
// make the stored hash trivially reversible by table lookup — anyone who can
// read project_helper_tokens.metadata (any authenticated Postgres role until
// the RLS policy on 0046 was tightened) could recover the plaintext PIN.
// Peppering with a server-only secret closes that: reversing the hash also
// requires the secret, which never reaches the database. Mirrors
// lib/driver-access/token.ts's hashDriverPin/verifyDriverPin exactly, with
// its OWN secret (not DRIVER_ACCESS_TOKEN_SECRET) because that env var is
// named and scoped to driver QR tokens specifically — conflating the two
// trust domains under one secret would mean rotating one flow's key silently
// changes the other's.
const DEV_FALLBACK_PIN_SECRET = "development-project-helper-pin-secret";

function projectHelperPinSecret(): string {
  const secret = readCleanEnv("PROJECT_HELPER_PIN_SECRET");
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PROJECT_HELPER_PIN_SECRET is not configured. Refusing to hash project helper PINs with the public development fallback."
    );
  }
  return DEV_FALLBACK_PIN_SECRET;
}

function hashHelperPin(pin: string): string {
  const secret = projectHelperPinSecret();
  return createHash("sha256").update(`helper-pin:${secret}:${pin.trim()}`).digest("hex");
}

// Lives here (not in the "use server" project-helper action file) because a
// "use server" module may only export async functions — a plain const there
// fails the build. Mirrors DRIVER_PIN_COOKIE_PREFIX's home in
// lib/driver-access/token.ts for the same reason.
export const HELPER_PIN_COOKIE_PREFIX = "hpin_";

export interface IssuedProjectHelperToken {
  rawToken: string;
  tokenId: string;
}

export async function issueProjectHelperToken(projectId: string, profileId: string, pin: string): Promise<IssuedProjectHelperToken | null> {
  const { client } = getSupabaseWriteClient();
  if (!client) return null;

  const rawToken = randomBytes(16).toString("hex");
  const { data, error } = await client
    .from("project_helper_tokens")
    .insert({ project_id: projectId, profile_id: profileId, token_hash: hashToken(rawToken), metadata: { pinHash: hashHelperPin(pin) } })
    .select("id")
    .single();
  if (error || !data) return null;
  return { rawToken, tokenId: String(data.id) };
}

export interface ProjectHelperClaim {
  tokenId: string;
  projectId: string;
  profileId: string;
  pinHash: string | null;
  /** Full metadata blob, needed by callers that read/write PIN-lockout state (lib/domain/driver-pin-lock.ts's pinAttempts/pinLockedUntil), not just pinHash. */
  metadata: Record<string, unknown>;
}

export async function findProjectHelperToken(rawToken: string): Promise<ProjectHelperClaim | null> {
  const { client } = getSupabaseWriteClient();
  if (!client) return null;

  const { data, error } = await client
    .from("project_helper_tokens")
    .select("id, project_id, profile_id, status, metadata")
    .eq("token_hash", hashToken(rawToken))
    .maybeSingle();
  if (error || !data || data.status !== "active") return null;

  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  return {
    tokenId: String(data.id),
    projectId: String(data.project_id),
    profileId: String(data.profile_id),
    pinHash: typeof metadata.pinHash === "string" ? metadata.pinHash : null,
    metadata
  };
}

// timingSafeEqual, not `===`: a plain string comparison leaks how many
// leading bytes matched through response timing, the same reason
// lib/driver-access/token.ts's verifyDriverPin doesn't use `===` either.
export function verifyProjectHelperPin(claim: ProjectHelperClaim, pin: string): boolean {
  if (!claim.pinHash) return false;
  const actual = Buffer.from(hashHelperPin(pin), "hex");
  const expected = Buffer.from(claim.pinHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** Merges a metadata patch (e.g. lib/domain/driver-pin-lock.ts's pinAttempts/pinLockedUntil) into a token row without disturbing pinHash or anything else already there — callers pass the full next metadata object, computed from the claim's own `metadata`. */
export async function updateProjectHelperTokenMetadata(tokenId: string, metadata: Record<string, unknown>): Promise<void> {
  const { client } = getSupabaseWriteClient();
  if (!client) return;
  await client.from("project_helper_tokens").update({ metadata }).eq("id", tokenId);
}

export async function revokeProjectHelperToken(tokenId: string): Promise<void> {
  const { client } = getSupabaseWriteClient();
  if (!client) return;
  await client.from("project_helper_tokens").update({ status: "revoked" }).eq("id", tokenId);
}
