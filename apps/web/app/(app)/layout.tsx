import { AppShell } from "@/components/app-shell";

// Authenticated operations workspace — wrapped in the full app shell (sidebar,
// nav, project scope, user menu). Driver / login / no-access live outside this
// group and get no shell.
export default function AppGroupLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
