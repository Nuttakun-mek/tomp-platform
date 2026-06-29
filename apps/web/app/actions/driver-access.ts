"use server";

import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { requirePermission } from "@/lib/auth/rbac";
import { buildDriverAccessUrl } from "@/lib/driver-access/url";
import { generateDriverAccessToken, getDefaultDriverTokenExpiry, hashDriverAccessToken } from "@/lib/driver-access/token";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

export async function createDriverAccessTokenAction(input: unknown): Promise<ActionResult> {
  const data = input as { projectId?: string; assignmentId?: string; driverId?: string | null; expiresAt?: string | null };
  if (!data.projectId || !data.assignmentId) {
    return actionFailure("projectId and assignmentId are required.");
  }

  const { client, error, mode } = getSupabaseWriteClient();
  if (!client) return actionFailure(error || "Supabase is not configured for writes.");

  const permission = await requirePermission(data.projectId, "assignment.update");
  if (!permission.allowed && mode !== "service_role") return actionFailure(permission.reason || "Missing permission: assignment.update");

  const token = generateDriverAccessToken({
    assignmentId: data.assignmentId,
    driverId: data.driverId,
    expiresAt: data.expiresAt
  });
  const expiresAt = data.expiresAt || getDefaultDriverTokenExpiry();

  const { data: row, error: insertError } = await client
    .from("driver_access_tokens")
    .insert({
      project_id: data.projectId,
      assignment_id: data.assignmentId,
      driver_id: data.driverId || null,
      token_hash: hashDriverAccessToken(token),
      status: "active",
      expires_at: expiresAt,
      metadata: { tokenVersion: 1 }
    })
    .select()
    .single();

  if (insertError) return actionFailure(`Driver access token creation failed: ${insertError.message}`);
  return actionSuccess({ token, accessUrl: buildDriverAccessUrl(token), tokenRecord: row });
}

