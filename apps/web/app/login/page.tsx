import { redirect } from "next/navigation";
import { LoginPanel } from "@/components/auth/login-panel";
import { getCurrentUserProfile } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

// Only ever bounce to a path on this site, so `?next=` cannot be used to send a
// signed-in viewer somewhere else.
function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/projects";
  return value === "/login" ? "/projects" : value;
}

interface LoginPageProps {
  searchParams?: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const profile = await getCurrentUserProfile();

  // Middleware also guards these routes now (it was dead while the legacy
  // vercel.json routing was in place). Send an already-signed-in viewer to
  // where they were headed rather than always to /projects.
  if (profile.authUserId || profile.isDevelopmentFallback) {
    redirect(safeNext(params.next));
  }

  return <LoginPanel />;
}
