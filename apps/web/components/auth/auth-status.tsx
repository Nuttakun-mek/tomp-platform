import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/auth/current-user";

export async function AuthStatus() {
  const profile = await getCurrentUserProfile();

  return (
    <div className="flex flex-col rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600">
      <span className="font-semibold text-ink">{profile.fullName}</span>
      <span>{profile.roleLabel}</span>
      {profile.isDevelopmentFallback ? <Link className="text-operation" href="/login">Auth setup placeholder</Link> : null}
    </div>
  );
}

