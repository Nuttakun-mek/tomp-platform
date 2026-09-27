import { redirect } from "next/navigation";

// This was three link cards repeating the tab bar above it (SuperadminShell).
export default function SuperadminPage() {
  redirect("/superadmin/users");
}
