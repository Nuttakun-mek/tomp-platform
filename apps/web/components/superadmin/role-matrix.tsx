"use client";

import { useState } from "react";
import { Check, ChevronDown, ShieldCheck } from "lucide-react";
import { permissionLabelTh, roleLabelTh, roleSummaryTh } from "@/lib/i18n/role-th";

interface RoleMatrixProps {
  roles: string[];
  permissions: string[];
  grid: Record<string, string[]>;
}

export function RoleMatrix({ roles, permissions, grid }: RoleMatrixProps) {
  // การอ่านเมทริกซ์ดิบเข้าใจยาก — ค่าเริ่มต้นจึงเป็นการ์ดต่อบทบาท
  // แล้วเก็บตารางเทียบทั้งหมดไว้ให้กางดูเมื่อต้องการ
  const [gridOpen, setGridOpen] = useState(false);

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => {
          const held = grid[role] ?? [];
          const wildcard = held.includes("*");
          const granted = wildcard ? permissions : permissions.filter((permission) => held.includes(permission));

          return (
            <article key={role} className="control-card grid content-start gap-2.5">
              <header className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[15px] font-semibold text-ink">{roleLabelTh(role)}</h3>
                  <p className="text-[11px] text-ink-faint">{role}</p>
                </div>
                {wildcard ? (
                  <span className="flex items-center gap-1 rounded-full bg-operation-soft px-2 py-1 text-[11px] font-semibold text-operation">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    ทุกสิทธิ์
                  </span>
                ) : (
                  <span className="rounded-full bg-canvas-strong px-2 py-1 text-[11px] font-semibold text-ink-soft">
                    {granted.length} สิทธิ์
                  </span>
                )}
              </header>

              <p className="text-[13px] leading-6 text-ink-soft">{roleSummaryTh(role)}</p>

              {granted.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {granted.map((permission) => (
                    <li
                      key={permission}
                      title={permission}
                      className="rounded-full border border-border/70 bg-white px-2 py-0.5 text-[11px] text-ink-soft"
                    >
                      {permissionLabelTh(permission)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-ink-faint">ไม่มีสิทธิ์ในระบบหลังบ้าน</p>
              )}
            </article>
          );
        })}
      </div>

      <div className="enterprise-panel overflow-hidden">
        <button
          type="button"
          onClick={() => setGridOpen((open) => !open)}
          aria-expanded={gridOpen}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-[13px] font-semibold text-ink"
        >
          ตารางเทียบบทบาท × สิทธิ์ (สำหรับตรวจสอบ)
          <ChevronDown className={`h-4 w-4 text-ink-faint transition ${gridOpen ? "rotate-180" : ""}`} />
        </button>

        {gridOpen ? (
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="sticky left-0 z-10 min-w-[190px] bg-white px-3 py-2.5 font-semibold text-ink">บทบาท</th>
                  {permissions.map((permission) => (
                    <th key={permission} className="whitespace-nowrap px-2.5 py-2.5 text-[11px] font-medium text-ink-soft">
                      {permissionLabelTh(permission)}
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
        ) : null}
      </div>
    </div>
  );
}
