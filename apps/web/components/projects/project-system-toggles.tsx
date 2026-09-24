"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleProjectSystemAction } from "@/app/actions/project-systems";

const SYSTEMS = [
  { key: "ground_transfer", label: "Ground Transfer" },
  { key: "airport_transfer", label: "Airport Transfer" }
];

// Ticking a box only marks the change; the save button applies it. Saving on
// tick left people unsure whether a system was actually switched on.
export function ProjectSystemToggles({ projectId, enabledSystems, editable }: { projectId: string; enabledSystems: string[]; editable: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => new Set(enabledSystems));
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ tone: "ok" | "err"; text: string; values: string } | null>(null);

  const saved = new Set(enabledSystems);
  const changes = SYSTEMS.filter((system) => draft.has(system.key) !== saved.has(system.key));
  const dirty = changes.length > 0;
  // A result describes the selection it saved; changing it again hides it.
  const values = JSON.stringify([...draft].sort());
  const msg = result && result.values === values ? result : null;

  function toggle(systemKey: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(systemKey)) next.delete(systemKey);
      else next.add(systemKey);
      return next;
    });
  }

  function save() {
    if (!dirty) return;
    setResult(null);
    startTransition(async () => {
      for (const system of changes) {
        const outcome = await toggleProjectSystemAction({ projectId, systemKey: system.key, enabled: draft.has(system.key) });
        if (!outcome.success) {
          setResult({ tone: "err", text: outcome.error || "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", values });
          router.refresh();
          return;
        }
      }
      setResult({ tone: "ok", text: "บันทึกระบบที่ใช้แล้ว", values });
      // The project bar above reads the enabled systems on the server.
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {SYSTEMS.map((system) => {
          // Every project must keep ground_transfer enabled — the action
          // rejects a request to disable it (toggleProjectSystemAction), so
          // this checkbox is locked once it's already saved on.
          const lockedOn = system.key === "ground_transfer" && saved.has(system.key);
          return (
            <label key={system.key} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" checked={draft.has(system.key)} disabled={!editable || pending || lockedOn} onChange={() => toggle(system.key)} />
              {system.label}
            </label>
          );
        })}
      </div>
      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
            className="rounded-xl bg-operation px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            {pending ? "กำลังบันทึก..." : "บันทึกระบบที่ใช้"}
          </button>
          {msg ? (
            <span className={`text-xs font-semibold ${msg.tone === "ok" ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</span>
          ) : !pending ? (
            <span className={`text-xs ${dirty ? "font-semibold text-amber-700" : "text-slate-500"}`}>
              {dirty ? "มีการเปลี่ยนแปลงที่ยังไม่บันทึก" : "ติ๊กเลือกระบบแล้วกดบันทึก"}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
