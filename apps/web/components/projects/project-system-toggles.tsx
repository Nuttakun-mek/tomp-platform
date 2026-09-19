"use client";

import { useState, useTransition } from "react";
import { toggleProjectSystemAction } from "@/app/actions/project-systems";

const SYSTEMS = [
  { key: "ground_transfer", label: "Ground Transfer" },
  { key: "airport_transfer", label: "Airport Transfer" }
];

export function ProjectSystemToggles({ projectId, enabledSystems, editable }: { projectId: string; enabledSystems: string[]; editable: boolean }) {
  const [enabled, setEnabled] = useState(new Set(enabledSystems));
  const [pending, startTransition] = useTransition();

  function toggle(systemKey: string) {
    const nextEnabled = !enabled.has(systemKey);
    startTransition(async () => {
      const result = await toggleProjectSystemAction({ projectId, systemKey, enabled: nextEnabled });
      if (result.success) {
        setEnabled((prev) => {
          const next = new Set(prev);
          if (nextEnabled) next.add(systemKey);
          else next.delete(systemKey);
          return next;
        });
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {SYSTEMS.map((system) => {
        // Every project must keep ground_transfer enabled — the action
        // rejects a request to disable it (toggleProjectSystemAction), so
        // this checkbox is locked once it's already on, matching what the
        // server will actually allow rather than letting someone attempt an
        // uncheck that only bounces back as an error.
        const lockedOn = system.key === "ground_transfer" && enabled.has(system.key);
        return (
          <label key={system.key} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <input type="checkbox" checked={enabled.has(system.key)} disabled={!editable || pending || lockedOn} onChange={() => toggle(system.key)} />
            {system.label}
          </label>
        );
      })}
    </div>
  );
}
