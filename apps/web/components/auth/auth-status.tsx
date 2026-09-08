import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { getCurrentUserProfile } from "@/lib/auth/current-user";

export async function AuthStatus() {
  const profile = await getCurrentUserProfile();
  const signedIn = Boolean(profile.authUserId);

  return (
    <div className="grid gap-2 rounded-xl border border-white/10 bg-white/8 px-3 py-3 text-[12px] text-slate-300">
      <div className="grid gap-0.5">
        <span className="font-semibold text-white">{profile.fullName}</span>
        <span>{profile.roleLabel}</span>
        {profile.email ? <span className="truncate text-slate-400">{profile.email}</span> : null}
      </div>

      {signedIn ? (
        <LogoutButton />
      ) : (
        <Link className="w-fit rounded-lg bg-white/10 px-3 py-1.5 font-semibold text-teal-100 transition hover:bg-white/15" href="/login">
          เข้าสู่ระบบ
        </Link>
      )}

      {profile.isDevelopmentFallback ? <p className="text-[11px] leading-5 text-amber-200">โหมดพัฒนา: ยังไม่ใช่สิทธิ์ production</p> : null}
    </div>
  );
}
