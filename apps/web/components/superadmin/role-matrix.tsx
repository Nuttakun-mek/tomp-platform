import { Check } from "lucide-react";
import { roleLabelTh } from "@/lib/i18n/role-th";

interface RoleMatrixProps {
  roles: string[];
  permissions: string[];
  grid: Record<string, string[]>;
}

export function RoleMatrix({ roles, permissions, grid }: RoleMatrixProps) {
  return (
    <div className="overflow-x-auto rounded-panel border border-border bg-white">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 z-10 min-w-[190px] bg-white px-3 py-2.5 font-semibold text-ink">บทบาท</th>
            {permissions.map((permission) => (
              <th key={permission} className="whitespace-nowrap px-2.5 py-2.5 text-[11px] font-medium text-ink-soft">
                {permission}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => {
            const held = new Set(grid[role] ?? []);
            const wildcard = held.has("*");
            return (
              <tr key={role} className="border-b border-border/60 last:border-0">
                <th className="sticky left-0 z-10 bg-white px-3 py-2 font-medium">
                  <span className="block text-ink">{roleLabelTh(role)}</span>
                  <span className="block text-[11px] text-ink-faint">{role}</span>
                </th>
                {wildcard ? (
                  <td colSpan={permissions.length} className="bg-operation-soft px-3 py-2 text-[12px] font-semibold text-operation">
                    ทุกสิทธิ์ (wildcard)
                  </td>
                ) : (
                  permissions.map((permission) => (
                    <td key={permission} className="px-2.5 py-2 text-center">
                      {held.has(permission) ? (
                        <Check className="mx-auto h-3.5 w-3.5 text-operation" />
                      ) : (
                        <span className="text-ink-faint">–</span>
                      )}
                    </td>
                  ))
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
