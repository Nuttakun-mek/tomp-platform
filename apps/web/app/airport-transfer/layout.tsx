import { redirect } from "next/navigation";
import { AirportTransferShell } from "@/components/airport-transfer/airport-transfer-shell";
import { getAirportTransferAccess } from "@/lib/airport-transfer/access";
import { getCurrentUserProfile } from "@/lib/auth/current-user";

// System-wide gate for what's left directly under /airport-transfer: the
// AirLabs provider settings page. It configures the flight-data provider for
// the whole system, not one project, so it stays account-scoped (super_admin
// or airport_admin on any project) rather than moving under a project code.
// Everything else that used to live here (cases, imports, trash, the
// dashboard) moved to /projects/[projectCode]/airport-transfer per 984.
//
// This page sits outside (app), so nothing else supplies it a shell —
// unlike the project-scoped pages (which get AppShell for free from
// (app)/layout.tsx), this one still needs AirportTransferShell.
export default async function AirportTransferSystemLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [access, profile] = await Promise.all([getAirportTransferAccess(), getCurrentUserProfile()]);
  if (!access.signedIn) redirect("/login?next=/airport-transfer/settings");
  if (!access.allowed) redirect("/no-access?module=airport-transfer");
  return <AirportTransferShell userName={profile.fullName} roleLabel={access.role || "airport_transfer"}>{children}</AirportTransferShell>;
}
