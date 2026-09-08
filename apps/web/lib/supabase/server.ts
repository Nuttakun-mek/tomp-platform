import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readCleanEnv } from "@/lib/env";
import { createTimeoutFetch } from "./fetch-timeout";

export function getSupabaseServerClient(): SupabaseClient | null {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return null;
  }

  const supabaseUrl = readCleanEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const supabaseAnonKey = readCleanEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: createTimeoutFetch(8000)
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function getSupabaseServerDataClient(): SupabaseClient | null {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return null;
  }

  const supabaseUrl = readCleanEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const supabaseServerKey = readCleanEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !supabaseServerKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServerKey, {
    global: {
      fetch: createTimeoutFetch(8000)
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
