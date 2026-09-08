import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readCleanEnv } from "@/lib/env";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";
import { createTimeoutFetch } from "./fetch-timeout";
import { scopedReadsFlagOn, shouldUseScopedClient } from "./scoped-decision";

// Session-aware read client: subject to RLS as the logged-in user (migration 0019/0020).
// Returns null when Supabase is not configured (dev without env).
// cache(): one client + one auth.getUser() per request, shared by every lib/data/* call.
export const getScopedDataClient = cache(async function getScopedDataClient(): Promise<SupabaseClient | null> {
  if (process.env.NEXT_PHASE === "phase-production-build") return null;

  const supabaseUrl = readCleanEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const supabaseAnonKey = readCleanEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY"
  );
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    global: { fetch: createTimeoutFetch(8000) },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Server Components cannot always write cookies; auth refresh handled in middleware.
      }
    }
  }) as unknown as SupabaseClient;
});

// Chooses the read client for lib/data/* functions:
//  - scoped session client when TOMP_SCOPED_READS=1 AND a real auth session exists
//  - service-role client otherwise (dev fallback, system reads, flag off)
// cache(): resolved once per request; every lib/data/* function reuses the decision.
export const resolveReadClient = cache(async function resolveReadClient(): Promise<{ client: SupabaseClient | null; scoped: boolean }> {
  if (scopedReadsFlagOn()) {
    const scoped = await getScopedDataClient();
    if (scoped) {
      const { data } = await scoped.auth.getUser();
      if (shouldUseScopedClient(true, Boolean(data.user))) return { client: scoped, scoped: true };
    }
  }
  return { client: getSupabaseServerDataClient(), scoped: false };
});
