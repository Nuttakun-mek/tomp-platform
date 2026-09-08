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

function freshnessOf(location: DriverLocation | undefined, now: number): Freshness {
  if (!location) return "none";
  if (location.sharingEvent === "sharing_stopped") return "offline";
  const age = Math.round((now - new Date(location.recordedAt).getTime()) / 1000);
  if (age <= 35) return "live";
  if (age <= 120) return "slow";
  return "offline";
}

const FRESH_DOT: Record<Freshness, string> = {
  live: "bg-emerald-500",
  slow: "bg-amber-500",
  offline: "bg-rose-500",
  none: "bg-slate-300"
};

const FRESH_LABEL: Record<Freshness, string> = {
  live: "GPS สด",
  slow: "GPS ช้า",
  offline: "GPS ขาดช่วง",
  none: "ยังไม่แชร์ GPS"
};

const ATTENTION_RANK: Record<Freshness, number> = { none: 0, offline: 1, slow: 2, live: 3 };

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
  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [, startResolve] = useTransition();

  function resolveMessage(id: string) {
    setResolvedIds((s) => new Set(s).add(id));
    startResolve(async () => {
      await resolveDriverMessageAction({ id, projectId }).catch(() => undefined);
    });
  }

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const [locRes, commsRes] = await Promise.all([
          fetch(`/api/mission-control/locations?projectId=${projectId}`, { cache: "no-store" }).then((r) => r.json()),
          fetch(`/api/mission-control/comms?projectId=${projectId}`, { cache: "no-store" }).then((r) => r.json())
        ]);
        if (!alive) return;
        if (locRes?.success !== false && Array.isArray(locRes?.data)) setLocations(locRes.data as DriverLocation[]);
        if (commsRes?.success && commsRes.data) {
          if (commsRes.data.statuses) setStatuses(commsRes.data.statuses as Record<string, AssignmentStatusUpdate>);
          if (commsRes.data.evidence) setEvidence(commsRes.data.evidence as Record<string, VehicleEvidence>);
          if (Array.isArray(commsRes.data.inbound)) setInbound(commsRes.data.inbound as DriverInboundMessage[]);
        }
        setNow(Date.now());
      } catch {
        /* keep last known */
      }
    }
    const timer = window.setInterval(poll, 10000);
    const clock = window.setInterval(() => setNow(Date.now()), 5000);
    void poll();
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.clearInterval(clock);
    };
  }, [projectId]);

  const callSignById = useMemo(() => new Map(callSigns.map((cs) => [cs.id, cs.callSign])), [callSigns]);
  const driverById = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const locationByAssignment = useMemo(() => {
    const map = new Map<string, DriverLocation>();
    for (const location of locations) {
      if (location.assignmentId) map.set(location.assignmentId, location);
    }
    return map;
  }, [locations]);
  const inboundByAssignment = useMemo(() => {
    const map = new Map<string, DriverInboundMessage[]>();
    for (const m of inbound) {
      const list = map.get(m.assignmentId) ?? [];
      list.push(m);
      map.set(m.assignmentId, list);
    }
    for (const list of map.values()) list.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return map;
  }, [inbound]);

  const rows = useMemo(() => {
    return assignments
      .map((assignment) => {
        const location = locationByAssignment.get(assignment.id);
        const freshness = freshnessOf(location, now);
        const msgs = inboundByAssignment.get(assignment.id) ?? [];
        const openMsgs = msgs.filter((m) => m.status !== "closed" && !resolvedIds.has(m.id));
        const unread = openMsgs.length;
        const hasIssue = openMsgs.some((m) => m.kind === "issue");
        return {
          assignment,
          label: callSignById.get(assignment.callSignId) ?? `งาน ${assignment.id.slice(0, 8)}`,
          driver: assignment.driverId ? driverById.get(assignment.driverId) : undefined,
          vehicle: assignment.vehicleId ? vehicleById.get(assignment.vehicleId) : undefined,
          location,
          freshness,
          reported: statuses[assignment.id],
          msgs,
          unread,
          hasIssue
        };
      })
      .sort((a, b) => {
        if (Boolean(b.unread) !== Boolean(a.unread)) return a.unread ? -1 : 1;
        const rank = ATTENTION_RANK[a.freshness] - ATTENTION_RANK[b.freshness];
        if (rank !== 0) return rank;
        return a.label.localeCompare(b.label, "th");
      });
  }, [assignments, locationByAssignment, inboundByAssignment, resolvedIds, now, statuses, driverById, vehicleById, callSignById]);

  const alertCount = rows.filter((r) => r.unread).length;

  return (
    <section className="enterprise-panel overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-semibold tracking-[0.16em] text-operation">ภาพรวมกองรถ</p>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold text-ink">
          สถานะรายคัน
          {alertCount ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
              <MessageSquare className="h-3 w-3" /> {alertCount} คันมีข้อความใหม่
            </span>
          ) : null}
        </h2>
        <p className="mt-1 text-xs text-slate-500">การ์ดละ 1 คัน · เรียงคันที่มีข้อความ/ต้องดูก่อน · แตะเพื่อกาง</p>
      </div>

      {rows.length ? (
        <div className="grid gap-2 p-3 sm:p-4">
          {rows.map((row) => {
            const open = expanded === row.assignment.id;
            const phone = row.driver?.phone ?? "";
            const ev = evidence[row.assignment.id];
            return (
              <article
                key={row.assignment.id}
                className={`overflow-hidden rounded-2xl border ${row.unread ? "border-rose-300 bg-rose-50/40" : "border-slate-200 bg-white"}`}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : row.assignment.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left"
                >
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${FRESH_DOT[row.freshness]}`} title={FRESH_LABEL[row.freshness]} />
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
                      {row.driver?.fullName ?? "ยังไม่ระบุคนขับ"} · {row.vehicle?.plateNumber ?? "ยังไม่ระบุรถ"}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      {row.reported ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                          ● {formatStatusTh(row.reported.status)} · {formatRelativeTh(row.reported.at, now)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">คนขับยังไม่แจ้งสถานะ</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 ${row.freshness === "live" ? "bg-emerald-50 text-emerald-700" : row.freshness === "slow" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                        {FRESH_LABEL[row.freshness]}
                      </span>
                    </span>
                  </span>
                  <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
                </button>

                {open ? (
                  <div className="grid gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                    <div className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                      <p>คนขับ: <span className="font-medium text-ink">{row.driver?.fullName ?? "-"}</span></p>
                      <p>เบอร์โทร: <span className="font-medium text-ink">{phone || "-"}</span></p>
                      <p>รถ: <span className="font-medium text-ink">{row.vehicle?.plateNumber ?? "-"} · {row.vehicle?.vehicleType ?? "-"}</span></p>
                      <p>ที่นั่ง: <span className="font-medium text-ink">{row.vehicle?.capacity ?? "-"}</span></p>
                      <p>สถานะแผน: <span className="font-medium text-ink">{formatStatusTh(row.assignment.status)}</span></p>
                      <p>
                        GPS ล่าสุด: <span className="font-medium text-ink">{row.location ? formatRelativeTh(row.location.recordedAt, now) : "ยังไม่มี"}</span>
                        {row.location?.accuracy ? ` · ±${Math.round(row.location.accuracy)} ม.` : ""}
                      </p>
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
                          <MapPin className="h-3.5 w-3.5" /> ตำแหน่งใน Google Maps
                        </a>
                      ) : null}
                    </div>

                    {row.msgs.length ? (
                      <div className="grid gap-1.5">
                        <p className="text-xs font-semibold text-slate-600">ข้อความจากคนขับ</p>
                        {row.msgs.slice(-4).map((m) => {
                          const done = m.status === "closed" || resolvedIds.has(m.id);
                          return (
                            <div
                              key={m.id}
                              className={`flex items-start justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-xs ${
                                done ? "border-slate-200 bg-slate-50 text-slate-400" : m.kind === "issue" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-700"
                              }`}
                            >
                              <span>
                                {m.kind === "issue" ? <span className="font-semibold">[แจ้งปัญหา] </span> : null}
                                {m.message || "(ไม่มีข้อความ)"}
                                <span className="ml-1 text-slate-400">· {formatRelativeTh(m.at, now)}</span>
                              </span>
                              {done ? (
                                <span className="shrink-0 text-emerald-600"><Check className="h-3.5 w-3.5" /></span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => resolveMessage(m.id)}
                                  className="shrink-0 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
                                >
                                  รับทราบ
                                </button>
                              )}
                            </div>
                          );
                        })}
                        <p className="text-[11px] text-slate-400">ตอบกลับได้ที่แผง “การสื่อสารกับคนขับ” ด้านล่าง</p>
                      </div>
                    ) : null}

                    {ev && (ev.vehiclePhotoUrl || ev.platePhotoUrl) ? (
                      <div>
                        <p className="text-xs font-semibold text-slate-600">หลักฐานตรวจรถ · {formatRelativeTh(ev.at, now)}</p>
                        <div className="mt-1 flex gap-2">
                          {ev.vehiclePhotoUrl ? (
                            <a href={ev.vehiclePhotoUrl} target="_blank" rel="noreferrer" className="block">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={ev.vehiclePhotoUrl} alt="รูปรถ" className="h-20 w-28 rounded-lg border border-slate-200 object-cover" />
                              <span className="mt-0.5 block text-center text-[10px] text-slate-500">รูปรถ</span>
                            </a>
                          ) : null}
                          {ev.platePhotoUrl ? (
                            <a href={ev.platePhotoUrl} target="_blank" rel="noreferrer" className="block">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={ev.platePhotoUrl} alt="รูปป้ายทะเบียน" className="h-20 w-28 rounded-lg border border-slate-200 object-cover" />
                              <span className="mt-0.5 block text-center text-[10px] text-slate-500">ป้ายทะเบียน</span>
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-600">ยังไม่มีรูปตรวจรถจากคนขับ</p>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="p-6 text-sm text-slate-600">ยังไม่มีงานที่จัดสรรในโครงการนี้ — สร้างงานที่หน้า “จัดงาน” ก่อน</div>
      )}
    </section>
  );
}
