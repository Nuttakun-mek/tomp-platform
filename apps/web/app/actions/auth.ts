"use server";

import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function signInWithEmailAction(input: unknown): Promise<ActionResult> {
  const email = typeof input === "object" && input && "email" in input ? String(input.email) : "";
  if (!email.includes("@")) {
    return actionFailure("Valid email is required.", { email: ["Enter a valid email address."] });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return actionFailure("Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo }
  });

  if (error) return actionFailure(`Email login failed: ${error.message}`);
  return actionSuccess({ email, redirectTo });
}

export async function getGoogleSignInUrlAction(): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return actionFailure("Supabase Auth is not configured.");
  }

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo }
  });

  if (error) return actionFailure(`Google login failed: ${error.message}`);
  return actionSuccess({ url: data.url });
}

export async function signOutAction(): Promise<ActionResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return actionFailure("Supabase Auth is not configured.");
  const { error } = await supabase.auth.signOut();
  if (error) return actionFailure(`Sign out failed: ${error.message}`);
  return actionSuccess({ signedOut: true });
}

