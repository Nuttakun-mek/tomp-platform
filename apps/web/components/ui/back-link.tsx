import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// A plain "up one level" link for pages that sit outside the project workspace
// tabs. Deep pages used to be navigational dead ends — the only way back was the
// browser button.
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-operation">
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
