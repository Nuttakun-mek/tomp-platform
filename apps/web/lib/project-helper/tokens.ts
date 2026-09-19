import "server-only";

import { randomBytes, createHash } from "crypto";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
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
    .insert({ project_id: projectId, profile_id: profileId, token_hash: hashToken(rawToken), metadata: { pinHash: hashToken(pin) } })
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
    pinHash: typeof metadata.pinHash === "string" ? metadata.pinHash : null
  };
}

export function verifyProjectHelperPin(claim: ProjectHelperClaim, pin: string): boolean {
  return claim.pinHash === hashToken(pin);
}

export async function revokeProjectHelperToken(tokenId: string): Promise<void> {
  const { client } = getSupabaseWriteClient();
  if (!client) return;
  await client.from("project_helper_tokens").update({ status: "revoked" }).eq("id", tokenId);
}
