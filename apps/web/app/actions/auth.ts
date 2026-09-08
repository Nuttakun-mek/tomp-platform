"use server";

import { actionFailure, actionSuccess, type ActionResult } from "@/lib/actions/action-result";
import { getSessionAwareAuthClient } from "@/lib/auth/auth-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function getSafeNext(input: unknown) {
  const next = typeof input === "object" && input && "next" in input ? String(input.next || "/") : "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signInWithEmailAction(input: unknown): Promise<ActionResult> {
  const email = typeof input === "object" && input && "email" in input ? String(input.email).trim().toLowerCase() : "";
  const next = getSafeNext(input);
  if (!email.includes("@")) {
    return actionFailure("กรุณากรอกอีเมลให้ถูกต้อง", { email: ["กรุณากรอกอีเมลให้ถูกต้อง"] });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return actionFailure("ยังไม่ได้ตั้งค่า Supabase Auth กรุณาตรวจค่า NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const callbackUrl = new URL("/auth/callback", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  callbackUrl.searchParams.set("next", next);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl.toString() }
  });

  if (error) return actionFailure(`ส่งลิงก์เข้าสู่ระบบไม่สำเร็จ: ${error.message}`);
  return actionSuccess({ email, redirectTo: callbackUrl.toString() });
}

export async function getGoogleSignInUrlAction(input?: unknown): Promise<ActionResult> {
  const next = getSafeNext(input);
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return actionFailure("ยังไม่ได้ตั้งค่า Supabase Auth");
  }

  const callbackUrl = new URL("/auth/callback", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  callbackUrl.searchParams.set("next", next);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl.toString() }
  });

  if (error) return actionFailure(`เข้าสู่ระบบด้วย Google ไม่สำเร็จ: ${error.message}`);
  return actionSuccess({ url: data.url });
}

export async function signOutAction(): Promise<ActionResult> {
  const supabase = await getSessionAwareAuthClient();
  if (!supabase) return actionFailure("ยังไม่ได้ตั้งค่า Supabase Auth");
  const { error } = await supabase.auth.signOut();
  if (error) return actionFailure(`ออกจากระบบไม่สำเร็จ: ${error.message}`);
  return actionSuccess({ signedOut: true });
}
