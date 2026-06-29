interface PermissionChipProps {
  label: string;
  allowed?: boolean;
}

export function PermissionChip({ label, allowed = true }: PermissionChipProps) {
  return (
    <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${allowed ? "border-teal-200 bg-teal-50 text-teal-800" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
      {label}
    </span>
  );
}

