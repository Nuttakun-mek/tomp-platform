"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/mission-control", label: "Mission Control" },
  { href: "/resources", label: "Resources" },
  { href: "/resources/drivers", label: "Drivers" },
  { href: "/resources/vehicles", label: "Vehicles" },
  { href: "/driver", label: "Driver" },
  { href: "/login", label: "Login" }
];

export function AppNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="grid gap-3">
      <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 lg:hidden" onClick={() => setOpen((current) => !current)} type="button">
        Menu
      </button>
      <nav className={`${open ? "grid" : "hidden"} gap-1 lg:grid`} aria-label="Primary navigation">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${active ? "bg-operation text-white" : "text-slate-700 hover:bg-slate-100 hover:text-operation"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

