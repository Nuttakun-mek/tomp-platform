import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readCleanEnv } from "@/lib/env";

export interface SupabaseWriteClientResult {
  client: SupabaseClient | null;
  mode: "service_role" | "anon_development" | "missing";
  error?: string;
}

export function getSupabaseWriteClient(): SupabaseWriteClientResult {
  const supabaseUrl = readCleanEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const serviceRoleKey = readCleanEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
  const anonKey = readCleanEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl) {
    return {
      client: null,
      mode: "missing",
      error: "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL is not configured."
    };
  }

  const key = serviceRoleKey || anonKey;

  if (!key) {
    return {
      client: null,
      mode: "missing",
      error: "SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY, or a publishable key is required for server-side writes."
    };
  }

  return {
    client: createClient(supabaseUrl, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }),
    mode: serviceRoleKey ? "service_role" : "anon_development"
  };
}
