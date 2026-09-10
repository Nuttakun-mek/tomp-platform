"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, MapPin, MessageSquare, Phone, TriangleAlert } from "lucide-react";
import type { Assignment, CallSign, Driver, DriverLocation, Vehicle } from "@tomp/types/domain";
import { resolveDriverMessageAction } from "@/app/actions/driver-notifications";
import type { DriverInboundMessage } from "@/lib/data/driver-comms";
import { metaString } from "@/lib/data/location-meta";
import { isUrgentMeta, orderDriverJobs } from "@/lib/domain/driver-day-order";
import { gpsFreshness, type GpsFreshness } from "@/lib/domain/gps-freshness";
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
  stopped: "หยุดแชร์",
  none: "ยังไม่แชร์ GPS"
};

const ATTENTION_RANK: Record<Freshness, number> = { none: 0, offline: 1, stopped: 1, slow: 2, idle: 3, live: 3 };

function freshnessOf(location: DriverLocation | undefined, now: number): Freshness {
  if (!location) return "none";
  return gpsFreshness(location.recordedAt, location.sharingEvent, now, location.metadata);
}

export function FleetBoard({ projectId, assignments, callSigns, drivers, vehicles }: FleetBoardProps) {
  const { locations, comms, now } = useMissionControlFeed();
  const { statuses, evidence, inbound } = comms;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [, startResolve] = useTransition();

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
        return {
          assignment,
          label: callSignById.get(assignment.callSignId) ?? `งาน ${assignment.id.slice(0, 8)}`,
          driver: assignment.driverId ? driverById.get(assignment.driverId) : undefined,
          vehicle: assignment.vehicleId ? vehicleById.get(assignment.vehicleId) : undefined,
          pickup: metaString(meta.pickupLocation || meta.pickup_location, "ยังไม่ระบุจุดรับ"),
          dropoff: metaString(meta.dropoffLocation || meta.dropoff_location, "ยังไม่ระบุจุดส่ง"),
          location,
          freshness,
          reported: statuses[assignment.id],
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
  }, [assignments, callSignById, driverById, effectiveNow, evidence, inboundByAssignment, locationByAssignment, resolvedIds, statuses, vehicleById]);

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
      .map(([key, list]) => {
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
          evidence: list.find((row) => row.evidence)?.evidence,
          title: list[0].driver?.fullName ?? list[0].label
        };
      })
      .sort((a, b) => {
        if (Boolean(b.unread) !== Boolean(a.unread)) return a.unread ? -1 : 1;
        const rank = ATTENTION_RANK[a.freshness] - ATTENTION_RANK[b.freshness];
        if (rank !== 0) return rank;
        return a.title.localeCompare(b.title, "th");
      });
  }, [rows]);

  const alertCount = groups.filter((group) => group.unread).length;
  const liveCount = groups.filter((group) => group.freshness === "live").length;
  const needsAttention = groups.filter((group) => group.unread || group.freshness !== "live").length;

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
            <Tooltip content="รายการที่ต้องติดตามรวมรถที่ไม่มี GPS สด รถที่ยังไม่แชร์ตำแหน่ง และรถที่มีข้อความยังไม่รับทราบ">
              <span className="grid h-7 w-7 place-items-center rounded-full border border-slate-300 text-xs font-semibold text-slate-500">?</span>
            </Tooltip>
          </div>
        </div>
      </div>

      {groups.length ? (
        <div className="grid gap-2 p-3 sm:p-4 lg:grid-cols-2 2xl:grid-cols-3">
          {visibleGroups.map((group) => {
            const open = expanded === group.key;
            const phone = group.driver?.phone ?? "";
            const hasNext = group.jobs.some((job) => nextAssignmentIds.has(job.assignment.id));
            return (
              <article
                key={group.key}
                className={`overflow-hidden rounded-2xl border transition ${
                  group.unread ? "border-rose-300 bg-rose-50/50 shadow-sm" : "border-slate-200 bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : group.key)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left"
                >
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${FRESH_DOT[group.freshness]}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[15px] font-bold text-ink">{group.title}</span>
                      {group.jobs.length > 1 ? (
                        <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                          {group.jobs.length} งาน
                        </span>
                      ) : null}
                      {hasNext ? (
                        <span className="rounded-full bg-route px-1.5 py-0.5 text-[10px] font-bold text-white">มีงานถัดไป</span>
                      ) : null}
                      {group.unread ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {group.hasIssue ? <TriangleAlert className="h-2.5 w-2.5" /> : <MessageSquare className="h-2.5 w-2.5" />}
                          {group.unread}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {group.vehicle?.plateNumber ?? "ยังไม่ระบุรถ"} · {group.jobs.map((job) => job.label).join(", ")}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          group.freshness === "live"
                            ? "bg-emerald-50 text-emerald-700"
                            : group.freshness === "slow"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {FRESH_LABEL[group.freshness]}
                      </span>
                      {group.location ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                          {formatRelativeTh(group.location.recordedAt, effectiveNow)}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
                </button>

                {open ? (
                  <div className="grid gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    <div className="grid gap-1 text-xs text-slate-600">
                      <p>คนขับ: <span className="font-medium text-ink">{group.driver?.fullName ?? "-"}</span></p>
                      <p>เบอร์โทร: <span className="font-medium text-ink">{phone || "-"}</span></p>
                      <p>รถ: <span className="font-medium text-ink">{group.vehicle?.plateNumber ?? "-"} / {group.vehicle?.vehicleType ?? "-"}</span></p>
                      <p>GPS ล่าสุด: <span className="font-medium text-ink">{group.location ? formatRelativeTh(group.location.recordedAt, effectiveNow) : "ยังไม่มีข้อมูล"}</span></p>
                    </div>

                    <div className="grid gap-1.5">
                      <p className="text-xs font-semibold text-slate-600">งานของคนขับคนนี้ ({group.jobs.length})</p>
                      {group.jobs.map((job) => (
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
                          </div>
                          <p className="mt-1 text-slate-600">{job.pickup} → {job.dropoff}</p>
                          <p className="mt-0.5 text-slate-400">สถานะงาน: {formatStatusTh(job.assignment.status)}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
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
                                {message.kind === "issue" ? <span className="font-semibold">[แจ้งปัญหา] </span> : null}
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
        <div className="p-5 text-sm text-slate-600">ยังไม่มีงานที่จัดสรรในโครงการนี้ โปรดสร้างงานที่หน้า “จัดงาน” ก่อน</div>
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
