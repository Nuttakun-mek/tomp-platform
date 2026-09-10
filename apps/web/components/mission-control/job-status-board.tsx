"use client";

import { useMemo, useState } from "react";
import type { Assignment, CallSign, Driver, Mission, Vehicle } from "@tomp/types/domain";
import { formatStatusTh } from "@/lib/i18n/status-th";

// Eight kanban lanes needed a sideways scroll to read, which on an operations
// screen means the states past the fold are effectively invisible — and those
// are the late ones. Counting is the job here, not dragging: a dispatcher wants
// "how many are stuck" and then "which ones", so the states are a row of chips
// that wraps, and picking one filters a single list underneath.
//
// It lives in ศูนย์ควบคุม rather than จัดงาน because it answers "where does
// everything stand", not "what shall I set up". จัดงาน already shows each unit's
// own jobs in running order, which is the planning question.

const GROUPS: Array<{ key: string; label: string; match: (a: Assignment) => boolean; tone: string }> = [
  { key: "attention", label: "ต้องติดตาม", tone: "bg-rose-100 text-rose-800 ring-rose-200", match: (a) => ["draft", "planned"].includes(a.status) && (!a.driverId || !a.vehicleId || !a.callSignId) },
  { key: "ready", label: "เตรียมพร้อม", tone: "bg-slate-100 text-slate-700 ring-slate-200", match: (a) => Boolean(a.driverId && a.vehicleId && a.callSignId) && ["draft", "planned"].includes(a.status) },
  { key: "published", label: "พร้อมปฏิบัติงาน", tone: "bg-sky-100 text-sky-800 ring-sky-200", match: (a) => a.status === "published" },
  { key: "acknowledged", label: "รับทราบแล้ว", tone: "bg-indigo-100 text-indigo-800 ring-indigo-200", match: (a) => a.status === "acknowledged" },
  { key: "active", label: "กำลังปฏิบัติงาน", tone: "bg-teal-100 text-teal-800 ring-teal-200", match: (a) => a.status === "active" },
  { key: "parked", label: "พักงานไว้", tone: "bg-amber-100 text-amber-900 ring-amber-200", match: (a) => a.status === "parked" },
  { key: "completed", label: "เสร็จสิ้น", tone: "bg-emerald-100 text-emerald-800 ring-emerald-200", match: (a) => a.status === "completed" },
  { key: "cancelled", label: "ยกเลิก", tone: "bg-slate-100 text-slate-500 ring-slate-200", match: (a) => a.status === "cancelled" }
];

const TH_DAY = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" });

function whenLabel(start?: string | null, end?: string | null) {
  if (!start && !end) return "ยังไม่ระบุเวลา";
  const clock = (value?: string | null) => (value ? String(value).slice(11, 16) : "");
  const day = start ? TH_DAY.format(new Date(start)) : "";
  const from = clock(start);
  const to = clock(end);
  return [day, from && to ? `${from}–${to}` : from || to].filter(Boolean).join(" ");
}

export function JobStatusBoard({
  assignments,
  missions,
  callSigns,
  drivers,
  vehicles
}: {
  assignments: Assignment[];
  missions: Mission[];
  callSigns: CallSign[];
  drivers: Driver[];
  vehicles: Vehicle[];
}) {
  const [active, setActive] = useState<string | null>(null);

  const counted = useMemo(
    () => GROUPS.map((group) => ({ ...group, items: assignments.filter(group.match) })),
    [assignments]
  );

  const shown = useMemo(() => {
    const rows = active ? (counted.find((group) => group.key === active)?.items ?? []) : assignments;
    // Soonest first: the next thing to go wrong is the next thing due.
    return [...rows].sort((a, b) => String(a.startTime ?? "").localeCompare(String(b.startTime ?? "")));
  }, [active, assignments, counted]);

  const missionById = useMemo(() => new Map(missions.map((m) => [m.id, m.missionName])), [missions]);
  const callSignById = useMemo(() => new Map(callSigns.map((c) => [c.id, c.callSign])), [callSigns]);
  const driverById = useMemo(() => new Map(drivers.map((d) => [d.id, d.fullName])), [drivers]);
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v.plateNumber])), [vehicles]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActive(null)}
          className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 ring-inset transition ${
            active === null ? "bg-ink text-white ring-ink" : "bg-white text-ink-soft ring-slate-200 hover:bg-slate-50"
          }`}
        >
          ทั้งหมด {assignments.length}
        </button>
        {counted.map((group) => (
          <button
            key={group.key}
            type="button"
            onClick={() => setActive(active === group.key ? null : group.key)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 ring-inset transition ${
              active === group.key ? "bg-ink text-white ring-ink" : `${group.tone} hover:brightness-95`
            }`}
          >
            {group.label} {group.items.length}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-3 py-8 text-center text-xs text-slate-400">
          ไม่มีงานในสถานะนี้
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {shown.map((assignment) => (
            <li
              key={assignment.id}
              className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2"
            >
              <span className="rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-bold text-white">
                {callSignById.get(assignment.callSignId) ?? "—"}
              </span>
              <span className="whitespace-nowrap text-[12px] font-semibold text-ink">
                {whenLabel(assignment.startTime, assignment.endTime)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12px] text-ink-soft">
                  {missionById.get(assignment.missionId) || "ยังไม่ระบุภารกิจ"}
                </span>
                <span className="block truncate text-[11px] text-ink-faint">
                  {driverById.get(assignment.driverId ?? "") ?? "ยังไม่มีคนขับ"} ·{" "}
                  {vehicleById.get(assignment.vehicleId ?? "") ?? "ยังไม่มีรถ"}
                </span>
              </span>
              <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                {formatStatusTh(assignment.status)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
