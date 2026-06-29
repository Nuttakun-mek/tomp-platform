"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function getAuthBrowserClient() {
  return createSupabaseBrowserClient();
}

