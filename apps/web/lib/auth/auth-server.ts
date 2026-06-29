import "server-only";

import { getSupabaseServerClient, getSupabaseServerDataClient } from "@/lib/supabase/server";

export function getAuthServerClient() {
  return getSupabaseServerClient();
}

export function getAuthServerDataClient() {
  return getSupabaseServerDataClient();
}

export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

