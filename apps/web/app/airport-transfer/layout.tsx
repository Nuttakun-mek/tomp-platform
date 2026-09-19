import { redirect } from "next/navigation";
import { getAirportTransferAccess } from "@/lib/airport-transfer/access";

// System-wide gate for what's left directly under /airport-transfer: the
// AirLabs provider settings page. It configures the flight-data provider for
// the whole system, not one project, so it stays account-scoped (super_admin
// or airport_admin on any project) rather than moving under a project code.
// Everything else that used to live here (cases, imports, trash, the
// dashboard) moved to /projects/[projectCode]/airport-transfer per 984.
export default async function AirportTransferSystemLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const access = await getAirportTransferAccess();
  if (!access.signedIn) redirect("/login?next=/airport-transfer/settings");
  if (!access.allowed) redirect("/no-access?module=airport-transfer");
  return children;
}
