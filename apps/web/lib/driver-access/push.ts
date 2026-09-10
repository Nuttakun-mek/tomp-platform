import "server-only";

import { getPostgresClient } from "@/lib/db/postgres";
import { getSupabaseWriteClient } from "@/lib/supabase/server-write";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const SEND_TIMEOUT_MS = 8000;

export interface DriverPushMessage {
  title: string;
  body: string;
  priority?: "low" | "normal" | "high" | "critical";
  data?: Record<string, unknown>;
}

/**
 * Expo push tokens for the active mobile sessions of one assignment. The token
 * lives on driver_mobile_sessions.metadata (see saveMobileSessionPushToken), so
 * a revoked or expired session simply stops being reachable.
 */
async function tokensForAssignment(assignmentId: string): Promise<string[]> {
  const nowIso = new Date().toISOString();

  const { client } = getSupabaseWriteClient();
  if (client) {
    const { data, error } = await client
      .from("driver_mobile_sessions")
      .select("metadata")
      .eq("assignment_id", assignmentId)
      .eq("status", "active")
      .is("revoked_at", null)
      .gt("expires_at", nowIso);
    if (error || !Array.isArray(data)) return [];
    return collectTokens(data.map((row) => row.metadata));
  }

  const sql = getPostgresClient();
  if (!sql) return [];
  try {
    const rows = await sql<Array<{ metadata: unknown }>>`
      select metadata from driver_mobile_sessions
      where assignment_id = ${assignmentId} and status = 'active'
        and revoked_at is null and expires_at > ${nowIso}
    `;
    return collectTokens(rows.map((row) => row.metadata));
  } catch {
    return [];
  }
}

function collectTokens(metadataRows: unknown[]): string[] {
  const tokens = metadataRows
    .map((meta) => (meta && typeof meta === "object" ? (meta as Record<string, unknown>).pushToken : null))
    .filter((value): value is string => typeof value === "string" && value.startsWith("Expo"));
  return [...new Set(tokens)];
}

/**
 * Best effort delivery: a failed push must never fail the action that triggered
 * it. The notification row is already saved and the app still polls, so a push
 * that does not land only costs the driver the banner.
 */
export async function sendDriverPush(assignmentId: string, message: DriverPushMessage): Promise<{ sent: number }> {
  const tokens = await tokensForAssignment(assignmentId).catch(() => []);
  if (!tokens.length) return { sent: 0 };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(
        tokens.map((to) => ({
          to,
          title: message.title,
          body: message.body,
          sound: "default",
          channelId: "driver-alerts",
          priority: message.priority === "critical" || message.priority === "high" ? "high" : "default",
          data: { assignmentId, ...(message.data ?? {}) }
        }))
      )
    });
    return { sent: response.ok ? tokens.length : 0 };
  } catch {
    return { sent: 0 };
  } finally {
    clearTimeout(timer);
  }
}
