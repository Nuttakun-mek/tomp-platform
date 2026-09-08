"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, MapPin, Phone } from "lucide-react";
import type { Assignment, CallSign, Driver, DriverLocation, Vehicle } from "@tomp/types/domain";
import type { AssignmentStatusUpdate } from "@/lib/data/assignment-status";
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

export function FleetBoard({ projectId, assignments, callSigns, drivers, vehicles, initialLocations, initialStatuses }: FleetBoardProps) {
  const [locations, setLocations] = useState(initialLocations);
  const [statuses, setStatuses] = useState(initialStatuses);
  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState<string | null>(null);

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
        if (commsRes?.success && commsRes.data?.statuses) setStatuses(commsRes.data.statuses as Record<string, AssignmentStatusUpdate>);
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

  const rows = useMemo(() => {
    return assignments
      .map((assignment) => {
        const location = locationByAssignment.get(assignment.id);
        const freshness = freshnessOf(location, now);
        const reported = statuses[assignment.id];
        const driver = assignment.driverId ? driverById.get(assignment.driverId) : undefined;
        const vehicle = assignment.vehicleId ? vehicleById.get(assignment.vehicleId) : undefined;
        return {
          assignment,
          label: callSignById.get(assignment.callSignId) ?? `งาน ${assignment.id.slice(0, 8)}`,
          driver,
          vehicle,
          location,
          freshness,
          reported
        };
      })
      .sort((a, b) => {
        const rank = ATTENTION_RANK[a.freshness] - ATTENTION_RANK[b.freshness];
        if (rank !== 0) return rank;
        return a.label.localeCompare(b.label, "th");
      });
  }, [assignments, locationByAssignment, now, statuses, driverById, vehicleById, callSignById]);

  return (
    <section className="enterprise-panel overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-semibold tracking-[0.16em] text-operation">ภาพรวมกองรถ</p>
        <h2 className="mt-1 text-lg font-semibold text-ink">สถานะรายคัน · เรียงงานที่ต้องดูก่อน</h2>
        <p className="mt-1 text-xs text-slate-500">แถวละ 1 Call Sign — สถานะที่คนขับแจ้ง สถานะแผน และ GPS ล่าสุด · แตะเพื่อดูรายละเอียด</p>
      </div>

      {rows.length ? (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => {
            const open = expanded === row.assignment.id;
            const phone = row.driver?.phone ?? "";
            return (
              <li key={row.assignment.id}>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : row.assignment.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 sm:px-5"
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${FRESH_DOT[row.freshness]}`} title={FRESH_LABEL[row.freshness]} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold text-ink">{row.label}</span>
                      <span className="truncate text-xs text-slate-500">
                        {row.driver?.fullName ?? "ยังไม่ระบุคนขับ"} · {row.vehicle?.plateNumber ?? "ยังไม่ระบุรถ"}
                      </span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      {row.reported ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
                          ● {formatStatusTh(row.reported.status)} · {formatRelativeTh(row.reported.at, now)}
                        </span>
                      ) : (
                        <span className="text-slate-400">คนขับยังไม่แจ้งสถานะ</span>
                      )}
                      <span className="text-slate-400">แผน: {formatStatusTh(row.assignment.status)}</span>
                      <span className="text-slate-400">· {FRESH_LABEL[row.freshness]}</span>
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
                </button>

                {open ? (
                  <div className="grid gap-2 bg-slate-50 px-4 py-3 text-sm sm:px-5">
                    <div className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                      <p>คนขับ: <span className="font-medium text-ink">{row.driver?.fullName ?? "-"}</span></p>
                      <p>รถ: <span className="font-medium text-ink">{row.vehicle?.plateNumber ?? "-"} · {row.vehicle?.vehicleType ?? "-"}</span></p>
                      <p>เบอร์โทร: <span className="font-medium text-ink">{phone || "-"}</span></p>
                      <p>
                        GPS ล่าสุด: <span className="font-medium text-ink">{row.location ? formatRelativeTh(row.location.recordedAt, now) : "ยังไม่มี"}</span>
                        {row.location?.accuracy ? ` · ±${Math.round(row.location.accuracy)} ม.` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {phone ? (
                        <a
                          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                        >
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
                    <p className="text-[11px] text-slate-400">ส่งข้อความถึงคนขับได้ที่แผง “การสื่อสารกับคนขับ” ด้านล่าง</p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="p-6 text-sm text-slate-600">ยังไม่มีงานที่จัดสรรในโครงการนี้ — สร้างงานที่หน้า “จัดงาน” ก่อน</div>
      )}
    </section>
  );
}
