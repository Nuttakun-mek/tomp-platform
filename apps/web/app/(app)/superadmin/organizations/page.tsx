import { redirect } from "next/navigation";

// Single-org product — the organisation concept is retired from the UI.
export default function OrganizationsPage() {
  redirect("/superadmin");
}
