"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, MapPin, MessageSquare, Phone, TriangleAlert } from "lucide-react";
import type { Assignment, CallSign, Driver, DriverLocation, Vehicle } from "@tomp/types/domain";
import { resolveDriverMessageAction } from "@/app/actions/driver-notifications";
import type { AssignmentStatusUpdate } from "@/lib/data/assignment-status";
import type { DriverInboundMessage } from "@/lib/data/driver-comms";
import type { VehicleEvidence } from "@/lib/data/vehicle-evidence";
import { formatStatusTh } from "@/lib/i18n/status-th";
import { formatRelativeTh } from "@/lib/ui/relative-time";
import { Tooltip } from "@/components/ui/tooltip";

interface FleetBoardProps {
  projectId: string;
  assignments: Assignment[];
  callSigns: CallSign[];
  drivers: Driver[];
  vehicles: Vehicle[];
  initialLocations: DriverLocation[];
  initialStatuses: Record<string, AssignmentStatusUpdate>;
  initialEvidence?: Record<string, VehicleEvidence>;
  initialInbound?: DriverInboundMessage[];
}

type Freshness = "live" | "slow" | "offline" | "none";

const FRESH_DOT: Record<Freshness, string> = {
  live: "bg-emerald-500",
  slow: "bg-amber-500",
  offline: "bg-rose-500",
  none: "bg-slate-300"
};

const FRESH_LABEL: Record<Freshness, string> = {
  live: "GPS สด",
  slow: "GPS ขาดช่วง",
  offline: "ไม่พบสัญญาณ GPS",
  none: "ยังไม่แชร์ GPS"
};

const ATTENTION_RANK: Record<Freshness, number> = { none: 0, offline: 1, slow: 2, live: 3 };

function freshnessOf(location: DriverLocation | undefined, now: number): Freshness {
  if (!location) return "none";
  if (location.sharingEvent === "sharing_stopped") return "offline";
  const age = Math.round((now - new Date(location.recordedAt).getTime()) / 1000);
  if (age <= 35) return "live";
  if (age <= 120) return "slow";
  return "offline";
}

function safeMeta(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export function FleetBoard({
  projectId,
  assignments,
  callSigns,
  drivers,
  vehicles,
  initialLocations,
  initialStatuses,
  initialEvidence = {},
  initialInbound = []
}: FleetBoardProps) {
  const [locations, setLocations] = useState(initialLocations);
  const [statuses, setStatuses] = useState(initialStatuses);
  const [evidence, setEvidence] = useState(initialEvidence);
  const [inbound, setInbound] = useState(initialInbound);
  const [now, setNow] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [, startResolve] = useTransition();

  useEffect(() => {
    setNow(Date.now());
  }, []);

  function resolveMessage(id: string) {
    setResolvedIds((current) => new Set(current).add(id));
    startResolve(async () => {
      await resolveDriverMessageAction({ id, projectId }).catch(() => undefined);
    });
  }

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const [locRes, commsRes] = await Promise.all([
          fetch(`/api/mission-control/locations?projectId=${projectId}`, { cache: "no-store" }).then((response) => response.json()),
          fetch(`/api/mission-control/comms?projectId=${projectId}`, { cache: "no-store" }).then((response) => response.json())
        ]);
        if (!alive) return;
        if (locRes?.success !== false && Array.isArray(locRes?.data)) setLocations(locRes.data as DriverLocation[]);
        if (commsRes?.success && commsRes.data) {
          if (commsRes.data.statuses) setStatuses((prev) => ({ ...prev, ...(commsRes.data.statuses as Record<string, AssignmentStatusUpdate>) }));
          if (commsRes.data.evidence) setEvidence((prev) => ({ ...prev, ...(commsRes.data.evidence as Record<string, VehicleEvidence>) }));
          if (Array.isArray(commsRes.data.inbound)) setInbound(commsRes.data.inbound as DriverInboundMessage[]);
        }
        setNow(Date.now());
      } catch {
        // Keep the last known operating picture.
      }
    }

    const refreshTimer = window.setInterval(poll, 12000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 15000);
    void poll();
    return () => {
      alive = false;
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, [projectId]);

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
          pickup: safeMeta(meta.pickupLocation || meta.pickup_location, "ยังไม่ระบุจุดรับ"),
          dropoff: safeMeta(meta.dropoffLocation || meta.dropoff_location, "ยังไม่ระบุจุดส่ง"),
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

  const alertCount = rows.filter((row) => row.unread).length;
  const liveCount = rows.filter((row) => row.freshness === "live").length;
  const needsAttention = rows.filter((row) => row.unread || row.freshness !== "live").length;

  return (
    <section className="enterprise-panel overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="section-label">ภาพรวมรถในโครงการ</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">สถานะรถและคนขับรายคัน</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              เรียงรายการที่ต้องติดตามขึ้นก่อน กดการ์ดเพื่อดูรายละเอียดรถ คนขับ ตำแหน่ง และข้อความล่าสุด
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <MetricChip label="รถทั้งหมด" value={rows.length} />
            <MetricChip label="GPS สด" value={liveCount} tone="success" />
            <MetricChip label="ต้องติดตาม" value={needsAttention} tone="warning" />
            <MetricChip label="มีข้อความใหม่" value={alertCount} tone={alertCount ? "warning" : "neutral"} />
            <Tooltip content="รายการที่ต้องติดตามรวมรถที่ไม่มี GPS สด รถที่ยังไม่แชร์ตำแหน่ง และรถที่มีข้อความยังไม่รับทราบ">
              <span className="grid h-7 w-7 place-items-center rounded-full border border-slate-300 text-xs font-semibold text-slate-500">?</span>
            </Tooltip>
          </div>
        </div>
      </div>

      {rows.length ? (
        <div className="grid gap-2 p-3 sm:p-4 lg:grid-cols-2 2xl:grid-cols-3">
          {rows.map((row) => {
            const open = expanded === row.assignment.id;
            const phone = row.driver?.phone ?? "";
            return (
              <article
                key={row.assignment.id}
                className={`overflow-hidden rounded-2xl border transition ${
                  row.unread ? "border-rose-300 bg-rose-50/50 shadow-sm" : "border-slate-200 bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : row.assignment.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left"
                >
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${FRESH_DOT[row.freshness]}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[15px] font-bold text-ink">{row.label}</span>
                      {row.unread ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {row.hasIssue ? <TriangleAlert className="h-2.5 w-2.5" /> : <MessageSquare className="h-2.5 w-2.5" />}
                          {row.unread}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {row.driver?.fullName ?? "ยังไม่ระบุคนขับ"} / {row.vehicle?.plateNumber ?? "ยังไม่ระบุรถ"}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      {row.reported ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                          {formatStatusTh(row.reported.status)} / {formatRelativeTh(row.reported.at, effectiveNow)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">ยังไม่แจ้งสถานะ</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 ${
                        row.freshness === "live" ? "bg-emerald-50 text-emerald-700" : row.freshness === "slow" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {FRESH_LABEL[row.freshness]}
                      </span>
                    </span>
                  </span>
                  <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
                </button>

                {open ? (
                  <div className="grid gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    <div className="grid gap-1 text-xs text-slate-600">
                      <p>คนขับ: <span className="font-medium text-ink">{row.driver?.fullName ?? "-"}</span></p>
                      <p>เบอร์โทร: <span className="font-medium text-ink">{phone || "-"}</span></p>
                      <p>รถ: <span className="font-medium text-ink">{row.vehicle?.plateNumber ?? "-"} / {row.vehicle?.vehicleType ?? "-"}</span></p>
                      <p>จุดรับ: <span className="font-medium text-ink">{row.pickup}</span></p>
                      <p>จุดส่ง: <span className="font-medium text-ink">{row.dropoff}</span></p>
                      <p>สถานะงาน: <span className="font-medium text-ink">{formatStatusTh(row.assignment.status)}</span></p>
                      <p>GPS ล่าสุด: <span className="font-medium text-ink">{row.location ? formatRelativeTh(row.location.recordedAt, effectiveNow) : "ยังไม่มีข้อมูล"}</span></p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {phone ? (
                        <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                          <Phone className="h-3.5 w-3.5" /> โทรหาคนขับ
                        </a>
                      ) : null}
                      {row.location ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${row.location.latitude},${row.location.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700"
                        >
                          <MapPin className="h-3.5 w-3.5" /> เปิดตำแหน่งใน Google Maps
                        </a>
                      ) : null}
                    </div>

                    {row.messages.length ? (
                      <div className="grid gap-1.5">
                        <p className="text-xs font-semibold text-slate-600">ข้อความจากคนขับ</p>
                        {row.messages.slice(-4).map((message) => {
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

                    {row.evidence && (row.evidence.vehiclePhotoUrl || row.evidence.platePhotoUrl) ? (
                      <p className="text-xs font-semibold text-blue-700">มีหลักฐานรูปถ่ายตรวจรถแล้ว</p>
                    ) : (
                      <p className="text-[11px] text-amber-600">ยังไม่มีรูปถ่ายตรวจรถจากคนขับ</p>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="p-6 text-sm text-slate-600">ยังไม่มีงานที่จัดสรรในโครงการนี้ โปรดสร้างงานที่หน้า “จัดงาน” ก่อน</div>
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
