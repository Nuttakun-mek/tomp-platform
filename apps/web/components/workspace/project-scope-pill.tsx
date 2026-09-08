"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, FolderKanban } from "lucide-react";
import { SCOPE_COOKIE, type ScopeProject } from "@/lib/workspace/scope";
import { formatStatusTh } from "@/lib/i18n/status-th";

function setScopeCookie(projectId: string) {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${SCOPE_COOKIE}=${encodeURIComponent(projectId)}; path=/; max-age=${oneYear}; samesite=lax`;
}

export function ProjectScopePill({
  projects,
  activeId,
  variant = "dark"
}: {
  projects: ScopeProject[];
  activeId: string | null;
  variant?: "dark" | "light";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const active = projects.find((project) => project.id === activeId) ?? null;
  const dark = variant === "dark";

  if (!projects.length) {
    return (
      <div
        className={`flex items-center gap-2 rounded-[18px] border px-3 py-2.5 text-[12px] font-medium ${
          dark ? "border-white/10 bg-white/[0.05] text-slate-400" : "border-slate-200 bg-white text-slate-500"
        }`}
      >
        <FolderKanban className="h-4 w-4 shrink-0" />
        <span className="truncate">ยังไม่มีโครงการที่เข้าถึงได้</span>
      </div>
    );
  }

  function choose(projectId: string) {
    setOpen(false);
    if (projectId === activeId) return;
    setScopeCookie(projectId);
    router.refresh();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={`flex w-full items-center gap-2.5 rounded-[18px] border px-3 py-2.5 text-left transition ${
          dark
            ? "border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]"
            : "border-slate-200 bg-white text-ink shadow-sm hover:border-slate-300"
        }`}
      >
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[12px] ${dark ? "bg-white/10 text-teal-200" : "bg-operation-soft text-operation"}`}>
          <FolderKanban className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[10px] font-bold uppercase tracking-[0.18em] ${dark ? "text-slate-400" : "text-slate-500"}`}>โครงการที่ดูอยู่</span>
          <span className="block truncate text-[13px] font-semibold leading-5">
            {active ? `${active.projectCode} · ${active.projectName}` : "เลือกโครงการ"}
          </span>
        </span>
        <ChevronsUpDown className={`h-4 w-4 shrink-0 ${dark ? "text-slate-400" : "text-slate-400"}`} />
      </button>

      {open ? (
        <div
          className={`absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-72 overflow-y-auto rounded-[18px] border p-1.5 shadow-xl ${
            dark ? "border-white/10 bg-slate-900 text-white" : "border-slate-200 bg-white text-ink"
          }`}
        >
          {projects.map((project) => {
            const selected = project.id === activeId;
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => choose(project.id)}
                className={`flex w-full items-start gap-2 rounded-[12px] px-2.5 py-2 text-left transition ${
                  dark ? "hover:bg-white/10" : "hover:bg-slate-50"
                } ${selected ? (dark ? "bg-white/10" : "bg-slate-50") : ""}`}
              >
                <Check className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? "text-operation" : "opacity-0"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold leading-5">
                    {project.projectCode} · {project.projectName}
                  </span>
                  {project.status ? (
                    <span className={`block text-[11px] leading-4 ${dark ? "text-slate-400" : "text-slate-500"}`}>{formatStatusTh(project.status)}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
