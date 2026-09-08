import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserProfile } from "@/lib/auth/current-user";

// Authenticated operations workspace — wrapped in the full app shell (sidebar,
// nav, project scope, user menu). Driver / login / no-access live outside this
// group and get no shell.
//
// Server-side auth gate: the legacy vercel.json routing bypasses the Next.js
// middleware on production, so every route in this group is guarded here instead.
export default async function AppGroupLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const profile = await getCurrentUserProfile();
  const signedIn = Boolean(profile.authUserId) || profile.isDevelopmentFallback;
  if (!signedIn) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
