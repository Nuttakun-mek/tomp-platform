import Link from "next/link";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/mission-control", label: "Mission Control" },
  { href: "/resources", label: "Resources" },
  { href: "/resources/drivers", label: "Drivers" },
  { href: "/resources/vehicles", label: "Vehicles" },
  { href: "/driver", label: "Driver Demo" },
  { href: "/admin", label: "Admin" }
];

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-slate-50 text-ink">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/" className="flex flex-col">
            <span className="text-sm font-semibold uppercase tracking-wide text-operation">TOMP</span>
            <span className="text-lg font-semibold">Transportation Operations Management Platform</span>
          </Link>
          <nav className="flex flex-wrap gap-2" aria-label="Primary navigation">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-operation hover:text-operation"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-5 py-8">{children}</main>
    </div>
  );
}
