import { roleLabelTh } from "@/lib/i18n/role-th";
import type { ProjectMemberRow } from "@/lib/data/project-members";
import { AddProjectMemberForm } from "@/components/projects/add-project-member-form";

const SYSTEM_LABEL: Record<string, string> = { ground_transfer: "Ground Transfer", airport_transfer: "Airport Transfer" };

export function ProjectMemberList({
  projectId,
  members,
  enabledSystems,
  editable
}: {
  projectId: string;
  members: ProjectMemberRow[];
  enabledSystems: string[];
  editable: boolean;
}) {
  return (
    <div className="grid gap-3">
      {members.length ? (
        <ul className="divide-y divide-slate-100">
          {members.map((m) => (
            <li key={`${m.profileId}-${m.systemKey}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                <span className="font-medium text-ink">{m.fullName}</span>
                {m.email ? <span className="ml-2 text-xs text-slate-500">{m.email}</span> : null}
              </span>
              <span className="flex gap-1">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{SYSTEM_LABEL[m.systemKey] ?? m.systemKey}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{roleLabelTh(m.roleKey)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">ยังไม่มีสมาชิก</p>
      )}
      {editable ? <AddProjectMemberForm projectId={projectId} enabledSystems={enabledSystems} /> : null}
    </div>
  );
}
