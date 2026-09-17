import { redirect } from "next/navigation";
import { AirportTransferShell } from "@/components/airport-transfer/airport-transfer-shell";
import { getAirportTransferAccess } from "@/lib/airport-transfer/access";
import { getCurrentUserProfile } from "@/lib/auth/current-user";

export const metadata = {
  title: "Airport Transfer Control — TOMP",
  description: "ศูนย์บริหารงานรับเข้าและส่งออกผู้โดยสารสนามบิน"
};

export default async function AirportTransferLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [access, profile] = await Promise.all([getAirportTransferAccess(), getCurrentUserProfile()]);
  if (!access.signedIn) redirect("/login?next=/airport-transfer");
  if (!access.allowed) redirect("/no-access?module=airport-transfer");
  return <AirportTransferShell userName={profile.fullName} roleLabel={access.role || "airport_transfer"}>{children}</AirportTransferShell>;
}

