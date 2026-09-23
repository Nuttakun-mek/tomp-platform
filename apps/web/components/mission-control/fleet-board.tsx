"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CarFront, Check, ChevronDown, LocateFixed, MapPin, MessageSquare, Phone, TriangleAlert } from "lucide-react";
import type { Assignment, CallSign, Driver, DriverLocation, Vehicle } from "@tomp/types/domain";
import { resolveDriverMessageAction } from "@/app/actions/driver-notifications";
import type { DriverInboundMessage } from "@/lib/data/driver-comms";
import { metaString } from "@/lib/data/location-meta";
import { isUrgentMeta, orderDriverJobs } from "@/lib/domain/driver-day-order";
import { latestEvidenceByDriver } from "@/lib/domain/driver-evidence";
import { gpsFreshness, type GpsFreshness } from "@/lib/domain/gps-freshness";
import { estimateVehicleUsageCost, evaluateVehicleServiceTimeAlert, vehicleUsageCostBreakdown } from "@/lib/domain/vehicle-cost";
import { formatStatusTh } from "@/lib/i18n/status-th";
import { formatRelativeTh } from "@/lib/format/relative-time-th";
import { Tooltip } from "@/components/ui/tooltip";
import { useVisibleSlice } from "@/components/ui/use-visible-slice";
import { useMissionControlFeed } from "./mission-control-feed";

interface FleetBoardProps {
  projectId: string;
  assignments: Assignment[];
  callSigns: CallSign[];
  drivers: Driver[];
  vehicles: Vehicle[];
}

// "none" = this assignment has never shared a location; the shared helper covers
// the rest (live / slow / offline / stopped).
type Freshness = GpsFreshness | "none";

const FRESH_DOT: Record<Freshness, string> = {
  live: "bg-emerald-500",
  idle: "bg-sky-500",
  slow: "bg-amber-500",
  offline: "bg-rose-500",
  stopped: "bg-slate-400",
  none: "bg-slate-300"
};

const FRESH_LABEL: Record<Freshness, string> = {
  live: "GPS สด",
  idle: "จอดอยู่",
  slow: "สัญญาณช้า",
  offline: "ขาดการอัปเดต",
  stopped: "หยุดส่ง GPS",
  none: "ยังไม่ได้ส่ง GPS"
};

const ATTENTION_RANK: Record<Freshness, number> = { none: 0, offline: 1, stopped: 1, slow: 2, idle: 3, live: 3 };
const SERVICE_ALERT_CLASS = {
  neutral: "bg-slate-100 text-slate-600",
  success: "bg-emerald-50 text-emerald-800",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-rose-50 text-rose-700"
} as const;

const SERVICE_ALERT_COMPACT_CLASS = {
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-rose-200 bg-rose-50 text-rose-700"
} as const;

function formatTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("th-TH", { day: "2-digit", month: "short" }).format(date);
}

function formatAssignmentWindow(start?: string | null, end?: string | null) {
  const date = formatDate(start ?? end);
  const startTime = formatTime(start);
  const endTime = formatTime(end);
  if (date && startTime && endTime) return `${date} ${startTime}-${endTime}`;
  if (date && startTime) return `${date} ${startTime}`;
  if (date && endTime) return `${date} ถึง ${endTime}`;
  return "ยังไม่ระบุเวลา";
}

function formatShortCost(cost: ReturnType<typeof estimateVehicleUsageCost>) {
  if (cost.estimatedCost == null) return "ยังไม่ระบุค่าใช้จ่าย";
  const hours = cost.billableHours ?? cost.packageHours;
  return `${hours != null ? `${hours.toLocaleString("th-TH")} ชม. / ` : ""}${cost.estimatedCost.toLocaleString("th-TH")} บ.`;
}

function freshnessOf(location: DriverLocation | undefined, now: number): Freshness {
  if (!location) return "none";
  return gpsFreshness(location.recordedAt, location.sharingEvent, now, location.metadata);
}

export function FleetBoard({ projectId, assignments, callSigns, drivers, vehicles }: FleetBoardProps) {
  const { locations, comms, now } = useMissionControlFeed();
  const { statuses, workSessions, evidence, inbound } = comms;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [, startResolve] = useTransition();

  const focusOnMap = useCallback((pointId: string) => {
    window.dispatchEvent(new CustomEvent("tomp:open-collapsible", { detail: { storageKey: "mc.map" } }));
    document.getElementById("mission-live-map")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("tomp:focus-map-point", { detail: { id: pointId } }));
    }, 220);
  }, []);

  function resolveMessage(id: string) {
    setResolvedIds((current) => new Set(current).add(id));
    startResolve(async () => {
      await resolveDriverMessageAction({ id, projectId }).catch(() => undefined);
    });
  }

  const callSignById = useMemo(() => new Map(callSigns.map((item) => [item.id, item.callSign])), [callSigns]);
  const driverById = useMemo(() => new Map(drivers.map((item) => [item.id, item])), [drivers]);
  const vehicleById = useMemo(() => new Map(vehicles.map((item) => [item.id, item])), [vehicles]);
  const locationByAssignment = useMemo(() => {
    const map = new Map<string, DriverLocation>();
    for (const location of locations) {
      if (location.assignmentId) map.set(location.assignmentId, location);
    }
    return map;
  }, [locations]);
  const inboundByAssignment = useMemo(() => {
    const map = new Map<string, DriverInboundMessage[]>();
    for (const message of inbound) {
      const list = map.get(message.assignmentId) ?? [];
      list.push(message);
      map.set(message.assignmentId, list);
    }
    for (const list of map.values()) list.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return map;
  }, [inbound]);

  // The "next job" per driver, using the same ordering the driver's QR page shows.
  const nextAssignmentIds = useMemo(() => {
    const byDriver = new Map<string, Assignment[]>();
    for (const assignment of assignments) {
      if (!assignment.driverId || ["cancelled", "archived", "completed"].includes(assignment.status)) continue;
      const list = byDriver.get(assignment.driverId) ?? [];
      list.push(assignment);
      byDriver.set(assignment.driverId, list);
    }
    const next = new Set<string>();
    for (const list of byDriver.values()) {
      if (list.length < 2) continue;
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
      const nextJob = ordered.find((job) => job.isNext);
      if (nextJob) next.add(nextJob.id);
    }
    return next;
  }, [assignments]);

  // The check-in photo belongs to the driver who took it, not to whichever job
  // was open at the time — see lib/domain/driver-evidence.
  const evidenceByDriver = useMemo(() => latestEvidenceByDriver(evidence), [evidence]);

  const effectiveNow = now || Date.now();
  const rows = useMemo(() => {
    return assignments
      .filter((assignment) => !["cancelled", "archived", "draft"].includes(assignment.status))
      .map((assignment) => {
        const location = locationByAssignment.get(assignment.id);
        const freshness = freshnessOf(location, effectiveNow);
        const messages = inboundByAssignment.get(assignment.id) ?? [];
        const openMessages = messages.filter((message) => message.status !== "closed" && !resolvedIds.has(message.id));
        const meta = assignment.metadata;
        const vehicle = assignment.vehicleId ? vehicleById.get(assignment.vehicleId) : undefined;
        const workSession = workSessions[assignment.id];
        const cost = estimateVehicleUsageCost({
          assignmentStart: assignment.startTime,
          assignmentEnd: assignment.endTime,
          actualStart: workSession?.startedAt,
          actualEnd: workSession?.endedAt,
          vehicleMetadata: vehicle?.metadata
        });
        const serviceAlert = evaluateVehicleServiceTimeAlert({
          assignmentEnd: assignment.endTime,
          workSessionStatus: workSession?.status,
          actualEnd: workSession?.endedAt,
          extraHours: cost.extraHours,
          now: effectiveNow
        });
        return {
          assignment,
          label: callSignById.get(assignment.callSignId) ?? `งาน ${assignment.id.slice(0, 8)}`,
          driver: assignment.driverId ? driverById.get(assignment.driverId) : undefined,
          vehicle,
          pickup: metaString(meta.pickupLocation || meta.pickup_location, "ยังไม่ระบุจุดรับ"),
          dropoff: metaString(meta.dropoffLocation || meta.dropoff_location, "ยังไม่ระบุจุดส่ง"),
          location,
          freshness,
          reported: statuses[assignment.id],
          workSession,
          cost,
          serviceAlert,
          messages,
          unread: openMessages.length,
          hasIssue: openMessages.some((message) => message.kind === "issue"),
          evidence: evidence[assignment.id]
        };
      })
      .sort((a, b) => {
        if (Boolean(b.unread) !== Boolean(a.unread)) return a.unread ? -1 : 1;
        const rank = ATTENTION_RANK[a.freshness] - ATTENTION_RANK[b.freshness];
        if (rank !== 0) return rank;
        return a.label.localeCompare(b.label, "th");
      });
  }, [assignments, callSignById, driverById, effectiveNow, evidence, inboundByAssignment, locationByAssignment, resolvedIds, statuses, vehicleById, workSessions]);

  // One card per driver, not per assignment. A driver with several jobs used to
  // fill the board with near-identical cards; GPS and phone are the driver's
  // anyway, so the jobs belong inside their card.
  const groups = useMemo(() => {
    const byDriver = new Map<string, typeof rows>();
    for (const row of rows) {
      // Unassigned work has no driver to group under — keep it as its own card.
      const key = row.driver?.id ?? `assignment:${row.assignment.id}`;
      const list = byDriver.get(key) ?? [];
      list.push(row);
      byDriver.set(key, list);
    }

    return [...byDriver.entries()]
      .map(([key, unordered]) => {
        // Inside a card, jobs read as a running order: what the driver is on
        // now, then what comes next. The `rows` sort above ranks *cards* by how
        // much attention they need, which is the wrong axis here — it pushed
        // newly added work above the job in progress.
        const ordered = orderDriverJobs(
          unordered.map((row) => ({
            id: row.assignment.id,
            status: row.assignment.status,
            startTime: row.assignment.startTime ?? null,
            createdAt: row.assignment.createdAt ?? null,
            sequence: typeof row.assignment.metadata.sequence === "number" ? (row.assignment.metadata.sequence as number) : null,
            urgent: isUrgentMeta(row.assignment.metadata),
            isCurrent: row.assignment.status === "active"
          }))
        );
        const rank = new Map(ordered.map((job, index) => [job.id, index]));
        const list = [...unordered].sort(
          (a, b) => (rank.get(a.assignment.id) ?? 0) - (rank.get(b.assignment.id) ?? 0)
        );

        // GPS belongs to the driver, so the freshest signal across their jobs is
        // the one that describes them.
        const best = list.reduce((a, b) => (ATTENTION_RANK[b.freshness] > ATTENTION_RANK[a.freshness] ? b : a));
        const located = list
          .filter((row) => row.location)
          .sort((a, b) => new Date(b.location!.recordedAt).getTime() - new Date(a.location!.recordedAt).getTime())[0];
        const messages = list.flatMap((row) => row.messages).sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
        const unread = list.reduce((sum, row) => sum + row.unread, 0);
        return {
          key,
          driver: list[0].driver,
          vehicle: list.find((row) => row.vehicle)?.vehicle,
          jobs: list,
          freshness: best.freshness,
          location: located?.location,
          messages,
          unread,
          hasIssue: list.some((row) => row.hasIssue),
          evidence: (list[0].driver ? evidenceByDriver.get(list[0].driver.id) : undefined) ?? list.find((row) => row.evidence)?.evidence,
          title: list[0].driver?.fullName ?? list[0].label
        };
      })
      .sort((a, b) => {
        if (Boolean(b.unread) !== Boolean(a.unread)) return a.unread ? -1 : 1;
        const rank = ATTENTION_RANK[a.freshness] - ATTENTION_RANK[b.freshness];
        if (rank !== 0) return rank;
        return a.title.localeCompare(b.title, "th");
      });
  }, [evidenceByDriver, rows]);

  const alertCount = groups.filter((group) => group.unread).length;
  const liveCount = groups.filter((group) => group.freshness === "live").length;
  const needsAttention = groups.filter((group) => group.unread || group.freshness !== "live").length;
  const serviceTimeAlertCount = rows.filter((row) => row.serviceAlert.tone === "warning" || row.serviceAlert.tone === "danger").length;

  // Attention-ranked groups are already on top, so a cap never hides something urgent.
  const { visible: visibleGroups, hidden, hasMore, expanded: allShown, showAll, reset } = useVisibleSlice(groups, 15);

  return (
    <section className="enterprise-panel overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="section-label">ภาพรวมรถในโครงการ</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">สถานะคนขับรายคน</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              หนึ่งการ์ดต่อคนขับหนึ่งคน เรียงรายการที่ต้องติดตามขึ้นก่อน กดการ์ดเพื่อดูงานทั้งหมดของคนขับ ตำแหน่ง และข้อความล่าสุด
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <MetricChip label="คนขับทั้งหมด" value={groups.length} />
            <MetricChip label="งานทั้งหมด" value={rows.length} />
            <MetricChip label="GPS สด" value={liveCount} tone="success" />
            <MetricChip label="ต้องติดตาม" value={needsAttention} tone="warning" />
            <MetricChip label="มีข้อความใหม่" value={alertCount} tone={alertCount ? "warning" : "neutral"} />
            <MetricChip label="ใกล้/เกินเวลาบริการ" value={serviceTimeAlertCount} tone={serviceTimeAlertCount ? "warning" : "neutral"} />
            <Tooltip content="รายการที่ต้องติดตามรวมรถที่ไม่มี GPS สด รถที่ยังไม่ได้ส่งตำแหน่ง GPS และรถที่มีข้อความยังไม่รับทราบ">
              <span className="grid h-7 w-7 place-items-center rounded-full border border-slate-300 text-xs font-semibold text-slate-500">?</span>
            </Tooltip>
          </div>
        </div>
      </div>

      {groups.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),24rem))] gap-2 p-3 sm:p-4">
          {visibleGroups.map((group) => {
            const open = expanded === group.key;
            const phone = group.driver?.phone ?? "";
            const hasNext = group.jobs.some((job) => nextAssignmentIds.has(job.assignment.id));
            const primaryJob = group.jobs[0];
            const serviceFocus =
              group.jobs.find((job) => job.serviceAlert.tone === "danger") ??
              group.jobs.find((job) => job.serviceAlert.tone === "warning") ??
              primaryJob;
            const routeSummary = primaryJob ? `${primaryJob.pickup} → ${primaryJob.dropoff}` : "ยังไม่มีงานที่เปิดใช้งาน";
            const windowSummary = primaryJob ? formatAssignmentWindow(primaryJob.assignment.startTime, primaryJob.assignment.endTime) : "ยังไม่ระบุเวลา";
            const gpsSummary = group.location ? formatRelativeTh(group.location.recordedAt, effectiveNow) : FRESH_LABEL[group.freshness];
            const mapPointId = group.location ? group.location.assignmentId || group.location.driverId || group.location.id : "";
            return (
              <article
                key={group.key}
                className={`overflow-hidden rounded-2xl border shadow-sm transition ${
                  group.unread
                    ? "border-rose-300 bg-gradient-to-br from-rose-50 via-white to-white shadow-rose-100"
                    : "border-slate-200 bg-gradient-to-br from-white via-white to-slate-50/80 hover:border-teal-200 hover:shadow-md"
                }`}
              >
                <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-3 py-2.5 sm:px-3.5">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : group.key)}
                    className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-2 text-left"
                    aria-expanded={open}
                  >
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white ${FRESH_DOT[group.freshness]}`} />
                    <span className="min-w-0">
                      <span className="grid min-w-0 gap-1">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-[15px] font-bold text-ink">{group.title}</span>
                          {primaryJob ? (
                            <span className="shrink-0 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">{primaryJob.label}</span>
                          ) : null}
                          {group.jobs.length > 1 ? (
                            <span className="shrink-0 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                              {group.jobs.length} งาน
                            </span>
                          ) : null}
                          {group.unread ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {group.hasIssue ? <TriangleAlert className="h-2.5 w-2.5" /> : <MessageSquare className="h-2.5 w-2.5" />}
                              {group.unread}
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate text-xs font-medium text-slate-600">
                          {group.vehicle?.plateNumber ?? "ยังไม่ระบุรถ"} · {gpsSummary} · {windowSummary}
                        </span>
                        <span className="grid min-w-0 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <span className="truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700" title={routeSummary}>
                            {routeSummary}
                          </span>
                          <span className="flex min-w-0 items-center gap-1 overflow-hidden">
                            {hasNext ? (
                              <span className="shrink-0 rounded-full bg-route px-1.5 py-0.5 text-[10px] font-bold text-white">งานถัดไป</span>
                            ) : null}
                            {serviceFocus ? (
                              <span
                                className={`truncate rounded-full border px-2 py-0.5 text-[11px] font-bold ${SERVICE_ALERT_COMPACT_CLASS[serviceFocus.serviceAlert.tone]}`}
                                title={serviceFocus.serviceAlert.detail}
                              >
                                {serviceFocus.serviceAlert.label}
                              </span>
                            ) : null}
                            {primaryJob ? (
                              <span
                                className="shrink-0 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-operation"
                                title={vehicleUsageCostBreakdown(primaryJob.cost)}
                              >
                                {formatShortCost(primaryJob.cost)}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 items-start gap-1">
                    {mapPointId ? (
                      <button
                        type="button"
                        onClick={() => focusOnMap(mapPointId)}
                        className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 text-xs font-bold text-operation shadow-sm transition hover:border-teal-400 hover:bg-white focus-ring"
                        aria-label={`ไปที่รถของ ${group.title} บนแผนที่`}
                        title="ไปที่รถบนแผนที่"
                      >
                        <LocateFixed className="h-3.5 w-3.5" />
                        <span className="hidden 2xl:inline">ไปที่รถ</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : group.key)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-ink focus-ring"
                      aria-label={open ? "ซ่อนรายละเอียดคนขับ" : "แสดงรายละเอียดคนขับ"}
                      aria-expanded={open}
                    >
                      <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>

                {open ? (
                  <div className="grid gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    {/* The four key/value rows that used to open this panel are
                        gone: three of them repeated the header — the driver's
                        name is the card title, the plate and the GPS age are on
                        line two — and the fourth, the phone number, is the
                        โทรหาคนขับ button below. */}
                    <div className="grid gap-1.5">
                      <p className="text-xs font-semibold text-slate-600">งานของคนขับคนนี้ ({group.jobs.length})</p>
                      {group.jobs.map((job) => {
                        const hasOt = Boolean(job.cost.extraHours && job.cost.extraHours > 0);
                        return (
                          <div key={job.assignment.id} className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-bold text-ink">{job.label}</span>
                              {nextAssignmentIds.has(job.assignment.id) ? (
                                <span className="rounded-full bg-route px-1.5 py-0.5 text-[10px] font-bold text-white">งานถัดไป</span>
                              ) : null}
                              {job.reported ? (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                                  {formatStatusTh(job.reported.status)} / {formatRelativeTh(job.reported.at, effectiveNow)}
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">ยังไม่แจ้งสถานะ</span>
                              )}
                              {job.workSession?.status === "active" ? (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-800">บันทึกเวลาเข้าแล้ว</span>
                              ) : job.workSession?.status === "ended" ? (
                                <span className={`rounded-full px-2 py-0.5 font-semibold ${hasOt ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}>
                                  {hasOt ? "มีค่าล่วงเวลา" : "บันทึกเวลาออกแล้ว"}
                                </span>
                              ) : (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">ยังไม่บันทึกเวลาเข้า</span>
                              )}
                              <Tooltip content={job.serviceAlert.detail}>
                                <span className={`rounded-full px-2 py-0.5 font-semibold ${SERVICE_ALERT_CLASS[job.serviceAlert.tone]}`}>
                                  {job.serviceAlert.label}
                                </span>
                              </Tooltip>
                            </div>
                            <p className="mt-1 text-slate-600">{job.pickup} → {job.dropoff}</p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">สถานะงาน: {formatStatusTh(job.assignment.status)}</span>
                              <span className={`rounded-full px-2 py-0.5 font-semibold ${job.cost.estimatedCost != null ? "bg-teal-50 text-operation" : "bg-amber-50 text-amber-800"}`}>
                                {vehicleUsageCostBreakdown(job.cost)}
                              </span>
                              {job.workSession?.startedAt ? (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">เข้า {formatRelativeTh(job.workSession.startedAt, effectiveNow)}</span>
                              ) : null}
                              {job.workSession?.endedAt ? (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">ออก {formatRelativeTh(job.workSession.endedAt, effectiveNow)}</span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {mapPointId ? (
                        <button
                          type="button"
                          onClick={() => focusOnMap(mapPointId)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-bold text-operation shadow-sm transition hover:border-teal-400 hover:bg-white focus-ring"
                        >
                          <LocateFixed className="h-3.5 w-3.5" /> ไปยังรถบนแผนที่
                        </button>
                      ) : null}
                      {phone ? (
                        <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                          <Phone className="h-3.5 w-3.5" /> โทรหาคนขับ
                        </a>
                      ) : null}
                      {group.location ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${group.location.latitude},${group.location.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700"
                        >
                          <MapPin className="h-3.5 w-3.5" /> เปิดตำแหน่งใน Google Maps
                        </a>
                      ) : null}
                      {/* The two things the deleted vehicle panel had that this
                          card did not. A Call Sign is one driver in one vehicle,
                          so they belong on the same card rather than on a second
                          list of the same units keyed the other way. */}
                      {group.vehicle ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                            สถานะรถ: {formatStatusTh(group.vehicle.status)}
                          </span>
                          <Link
                            href={`/resources/vehicles/${group.vehicle.id}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                          >
                            <CarFront className="h-3.5 w-3.5" /> ดูรายละเอียดรถ
                          </Link>
                        </>
                      ) : null}
                    </div>

                    {group.messages.length ? (
                      <div className="grid gap-1.5">
                        <p className="text-xs font-semibold text-slate-600">ข้อความจากคนขับ</p>
                        {group.messages.slice(-4).map((message) => {
                          const done = message.status === "closed" || resolvedIds.has(message.id);
                          return (
                            <div
                              key={message.id}
                              className={`flex items-start justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-xs ${
                                done ? "border-slate-200 bg-slate-50 text-slate-400" : message.kind === "issue" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-700"
                              }`}
                            >
                              <span>
                                {message.kind === "issue" ? <span className="font-semibold">[เหตุขัดข้อง] </span> : null}
                                {message.message || "(ไม่มีข้อความ)"}
                                <span className="ml-1 text-slate-400">/ {formatRelativeTh(message.at, effectiveNow)}</span>
                              </span>
                              {done ? (
                                <span className="shrink-0 text-emerald-600"><Check className="h-3.5 w-3.5" /></span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => resolveMessage(message.id)}
                                  className="shrink-0 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
                                >
                                  รับทราบ
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {group.evidence && (group.evidence.vehiclePhotoUrl || group.evidence.platePhotoUrl) ? (
                      <p className="text-xs font-semibold text-blue-700">มีหลักฐานรูปถ่ายตรวจรถแล้ว</p>
                    ) : (
                      <p className="text-[11px] text-amber-600">ยังไม่มีรูปถ่ายตรวจรถจากคนขับ</p>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
          {hasMore || allShown ? (
            <button
              type="button"
              onClick={hasMore ? showAll : reset}
              className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-operation hover:text-operation"
            >
              {hasMore ? `ดูทั้งหมด (อีก ${hidden})` : "ย่อรายการ"}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="p-5 text-sm text-slate-600">ยังไม่มีงานที่จัดสรรในโครงการนี้ โปรดเปิดงานที่หน้า “จัดการโครงการ” ก่อน</div>
      )}
    </section>
  );
}

function MetricChip({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "warning" }) {
  const className = tone === "success" ? "bg-emerald-50 text-emerald-800" : tone === "warning" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {label}: {value}
    </span>
  );
}
