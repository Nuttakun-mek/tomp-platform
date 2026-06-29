"use client";

import { useState } from "react";
import { getGoogleSignInUrlAction, signInWithEmailAction } from "@/app/actions/auth";

export function LoginPanel() {
  const [message, setMessage] = useState<string | null>(null);

  async function handleEmail(formData: FormData) {
    const result = await signInWithEmailAction({ email: formData.get("email") });
    setMessage(result.success ? "Check your email for the login link." : result.error || "Login failed.");
  }

  async function handleGoogle() {
    const result = await getGoogleSignInUrlAction();
    if (result.success && result.data && typeof result.data === "object" && "url" in result.data && typeof result.data.url === "string") {
      window.location.href = result.data.url;
      return;
    }
    setMessage(result.error || "Google login is not configured.");
  }

  return (
    <section className="grid gap-5 rounded-md border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Login</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Supabase email magic link and Google OAuth are wired as the first zero-cost auth options. Enterprise SSO is deferred.
        </p>
      </div>
      <form action={handleEmail} className="grid gap-3 md:max-w-md">
        <input className="rounded-md border border-slate-300 px-3 py-2" name="email" placeholder="Email address" type="email" />
        <button className="rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" type="submit">
          Continue with Email
        </button>
      </form>
      <button className="w-fit rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" onClick={handleGoogle} type="button">
        Continue with Google
      </button>
      {message ? <p className="text-sm font-medium text-slate-700">{message}</p> : null}
      <p className="text-xs leading-5 text-slate-500">Session persistence and production SSO hardening remain Sprint 15+ review items.</p>
    </section>
  );
}

