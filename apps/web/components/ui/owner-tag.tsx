import { UserRound, UserRoundX } from "lucide-react";
import { formatOwnerLine } from "@/lib/ui/owner-line";

interface OwnerTagProps {
  name?: string | null;
  roleKey?: string | null;
  at?: string | null;
  className?: string;
}

// Every operational object (assignment, incident, change, mission) should show
// who owns it + their role + when it was last touched — never "floating".
export function OwnerTag({ name, roleKey, at, className }: OwnerTagProps) {
  const known = Boolean(name && name.trim());
  const Icon = known ? UserRound : UserRoundX;

  return (
    <p className={`meta-text inline-flex items-center gap-1.5 ${known ? "" : "text-ink-faint"} ${className ?? ""}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{formatOwnerLine({ name, roleKey, at })}</span>
    </p>
  );
}
