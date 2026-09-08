import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-ink-faint">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1">
          {index > 0 ? <ChevronRight className="h-3 w-3 text-border" /> : null}
          {item.href ? (
            <Link href={item.href} className="font-medium hover:text-operation">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-ink-soft">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
