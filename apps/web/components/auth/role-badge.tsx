import { roleLabelTh } from "@/lib/i18n/role-th";

export function RoleBadge({ roleKey }: { roleKey: string | null }) {
  const isPlatform = roleKey === "super_admin";
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        isPlatform ? "bg-pilot/20 text-pilot" : "bg-white/10 text-slate-200"
      }`}
    >
      {roleLabelTh(roleKey)}
    </span>
  );
}
