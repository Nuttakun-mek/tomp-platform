import { redirect } from "next/navigation";
import { LoginPanel } from "@/components/auth/login-panel";
import { getCurrentUserProfile } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Middleware is bypassed by the legacy vercel.json routing, so bounce an
  // already-signed-in viewer here too.
  const profile = await getCurrentUserProfile();
  if (profile.authUserId || profile.isDevelopmentFallback) {
    redirect("/projects");
  }
  return <LoginPanel />;
}
