import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseServerClient, getSupabaseServerDataClient } from "@/lib/supabase/server";
import { readCleanEnv } from "@/lib/env";

export function getAuthServerClient() {
  return getSupabaseServerClient();
}

export function getAuthServerDataClient() {
  return getSupabaseServerDataClient();
}

export function isAuthConfigured(): boolean {
  return Boolean(readCleanEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL") && readCleanEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY"));
}

export async function getSessionAwareAuthClient() {
  const supabaseUrl = readCleanEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const supabaseAnonKey = readCleanEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey) return null;

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components can read cookies but cannot always write them.
        }
      }
    }
  });
}
