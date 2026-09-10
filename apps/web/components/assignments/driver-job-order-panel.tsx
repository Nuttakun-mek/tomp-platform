"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, TriangleAlert } from "lucide-react";
import type { Assignment, CallSign, Driver } from "@tomp/types/domain";
import { setAssignmentOrderAction } from "@/app/actions/assignments";
import { findDriverTimeConflicts } from "@/lib/domain/assignment-conflicts";
import { isUrgentMeta, orderDriverJobs } from "@/lib/domain/driver-day-order";

interface DriverJobOrderPanelProps {
  projectId: string;
  assignments: Assignment[];
  callSigns: CallSign[];
  drivers: Driver[];
}

const ACTIVE = new Set(["draft", "planned", "published", "active"]);

interface JobRow {
  id: string;
  label: string;
  startTime: string | null;
  urgent: boolean;
}

export function DriverJobOrderPanel({ projectId, assignments, callSigns, drivers }: DriverJobOrderPanelProps) {
  const callSignById = useMemo(() => new Map(callSigns.map((cs) => [cs.id, cs])), [callSigns]);
  const driverById = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver])), [drivers]);

  const groups = useMemo(() => {
    const byCallSign = new Map<string, Assignment[]>();
    for (const assignment of assignments) {
      if (!assignment.callSignId || !ACTIVE.has(assignment.status)) continue;
      const list = byCallSign.get(assignment.callSignId) ?? [];
      list.push(assignment);
      byCallSign.set(assignment.callSignId, list);
    }

    return [...byCallSign.entries()]
      .filter(([, list]) => list.length >= 2)
      .map(([callSignId, list]) => {
        const callSign = callSignById.get(callSignId);
        const driver = callSign?.driverId ? driverById.get(callSign.driverId) : undefined;
        const ordered = orderDriverJobs(
          list.map((assignment) => ({
            id: assignment.id,
            status: assignment.status,
            startTime: assignment.startTime ?? null,
            createdAt: assignment.createdAt ?? null,
            sequence: typeof assignment.metadata.sequence === "number" ? (assignment.metadata.sequence as number) : null,
            urgent: isUrgentMeta(assignment.metadata),
            isCurrent: assignment.status === "active"
          }))
        );

        return {
          callSignId,
          title: `${callSign?.callSign ?? "Call Sign"}${driver ? ` / ${driver.fullName}` : ""}`,
          rows: ordered.map<JobRow>((job) => ({
            id: job.id,
            label: `งาน ${job.id.slice(0, 8)}`,
            startTime: job.startTime,
            urgent: job.urgent
          }))
        };
      });
  }, [assignments, callSignById, driverById]);

  const conflicts = useMemo(() => {
    const set = new Set<string>();
    for (const conflict of findDriverTimeConflicts(
      assignments.map((assignment) => ({
        id: assignment.id,
        driverId: assignment.driverId ?? null,
        startTime: assignment.startTime ?? null,
        endTime: assignment.endTime ?? null,
        status: assignment.status
      }))
    )) {
      set.add(conflict.a);
      set.add(conflict.b);
    }
    return set;
  }, [assignments]);

  if (!groups.length) return null;

  return (
    <section className="enterprise-panel-soft grid gap-4 p-4">
      <div>
        <p className="section-label">ลำดับงานต่อ Call Sign</p>
        <h2 className="section-title mt-1">Call Sign ที่มีหลายงานในวันเดียวกัน</h2>
        <p className="section-description mt-1">
          จัดลำดับงานบน slot ปฏิบัติการเดียวกัน เพื่อให้รถและคนขับเห็นงานก่อนหลังชัดเจน แม้มีการเปลี่ยนคนขับภายหลัง งานยังอยู่กับ Call Sign เดิม
        </p>
      </div>

      <div className="grid gap-3">
        {groups.map((group) => (
          <CallSignJobGroup
            key={group.callSignId}
            projectId={projectId}
            callSignId={group.callSignId}
            title={group.title}
            initialRows={group.rows}
            conflictIds={conflicts}
          />
        ))}
      </div>
    </section>
  );
}

function CallSignJobGroup({
  projectId,
  callSignId,
  title,
  initialRows,
  conflictIds
}: {
  projectId: string;
  callSignId: string;
  title: string;
  initialRows: JobRow[];
  conflictIds: Set<string>;
}) {
  const [rows, setRows] = useState(initialRows);
  const [saved, setSaved] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = rows.map((row) => `${row.id}:${row.urgent}`).join("|") !== initialRows.map((row) => `${row.id}:${row.urgent}`).join("|");

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    setRows(next);
    setSaved(null);
  }

  function toggleUrgent(id: string) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, urgent: !row.urgent } : row)));
    setSaved(null);
  }

  function save() {
    setSaved(null);
    startTransition(async () => {
      const result = await setAssignmentOrderAction({
        projectId,
        callSignId,
        orderedAssignmentIds: rows.map((row) => row.id),
        urgentAssignmentIds: rows.filter((row) => row.urgent).map((row) => row.id)
      });
      setSaved(result.success ? "บันทึกลำดับแล้ว คนขับจะเห็นตามลำดับนี้" : result.error || "บันทึกไม่สำเร็จ");
    });
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold text-ink">{title}</p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{rows.length} งาน</span>
      </div>

      <ol className="mt-2 grid gap-1.5">
        {rows.map((row, index) => (
          <li
            key={row.id}
            className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-[13px] ${
              row.urgent ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"
            }`}
          >
            <span className="w-5 shrink-0 text-center font-bold text-slate-500">{index + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-ink">{row.label}</span>
                {conflictIds.has(row.id) ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                    <TriangleAlert className="h-2.5 w-2.5" /> เวลาชนกัน
                  </span>
                ) : null}
              </span>
              <span className="block text-[11px] text-slate-500">
                {row.startTime ? new Date(row.startTime).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "ยังไม่ระบุเวลา"}
              </span>
            </span>
            <button
              type="button"
              onClick={() => toggleUrgent(row.id)}
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                row.urgent ? "bg-amber-500 text-white" : "border border-slate-300 text-slate-500"
              }`}
            >
              ด่วน
            </button>
            <span className="flex shrink-0 flex-col">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="text-slate-400 hover:text-operation disabled:opacity-30">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === rows.length - 1}
                className="text-slate-400 hover:text-operation disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || isPending}
          className="rounded-xl bg-operation px-4 py-2 text-[13px] font-semibold text-white disabled:bg-slate-300"
        >
          {isPending ? "กำลังบันทึก..." : "บันทึกลำดับ"}
        </button>
        {saved ? <span className="text-[12px] font-semibold text-slate-600">{saved}</span> : null}
      </div>
    </article>
  );
}
