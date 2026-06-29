import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { getCurrentUserProfile } from "@/lib/auth/current-user";

export async function AuthStatus() {
  const profile = await getCurrentUserProfile();

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600 shadow-sm">
      <div className="grid gap-0.5">
        <span className="font-semibold text-ink">{profile.fullName}</span>
        <span>{profile.roleLabel}</span>
      </div>
      {profile.isDevelopmentFallback ? <Link className="font-semibold text-operation" href="/login">Configure auth</Link> : <LogoutButton />}
    </div>
  );
}
