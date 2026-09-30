"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, BellRing, ChevronDown, Volume2, VolumeX, X } from "lucide-react";
import type { Assignment, CallSign, Mission, Vehicle } from "@tomp/types/domain";
import { computeControlAlerts, type AlertUnitDay, type ControlAlert } from "@/lib/domain/control-alerts";
import { readDutySchedule, unitDutyDay } from "@/lib/domain/duty-hours";
import { useMissionControlFeed } from "./mission-control-feed";
import { OPEN_COMMS_EVENT } from "./fleet-board";

// The control room's alarm: current alerts in one bar at the top, and each new
// one announced once — a short tone (if the controller turned sound on) and a
// desktop notification when the tab is in the background.

const SOUND_KEY = "mc.alerts.sound";
const seenKey = (projectId: string) => `mc.alerts.seen.${projectId}`;
const SEEN_TTL_MS = 12 * 60 * 60 * 1000;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode — alerts still show, they just may repeat after a reload */
  }
}

function beep(context: AudioContext, danger: boolean) {
  const tones = danger ? [880, 660, 880] : [740];
  tones.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    gain.connect(context.destination);
    const start = context.currentTime + index * 0.22;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    oscillator.start(start);
    oscillator.stop(start + 0.2);
  });
}

export function ControlAlerts({
  projectId,
  assignments,
  callSigns,
  vehicles,
  missions = []
}: {
  projectId: string;
  assignments: Assignment[];
  callSigns: CallSign[];
  vehicles: Vehicle[];
  missions?: Mission[];
}) {
  const { locations, comms, now } = useMissionControlFeed();
  const [soundOn, setSoundOn] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(true);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setSoundOn(readJson(SOUND_KEY, false));
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  const alerts = useMemo<ControlAlert[]>(() => {
    if (!now) return [];
    const callSignById = new Map(callSigns.map((item) => [item.id, item.callSign]));
    const vehicleById = new Map(vehicles.map((item) => [item.id, item]));
    const byAssignment = new Map(locations.filter((l) => l.assignmentId).map((l) => [l.assignmentId!, l]));
    const byDriver = new Map(locations.filter((l) => l.driverId).map((l) => [l.driverId!, l]));
    const jobs = assignments.map((assignment) => ({
      id: assignment.id,
      label: (assignment.callSignId && callSignById.get(assignment.callSignId)) || `งาน ${assignment.id.slice(0, 6)}`,
      status: assignment.status,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
    }));
    const locationFor: Record<string, { recordedAt: string; sharingEvent?: string | null; metadata?: unknown } | undefined> = {};
    for (const assignment of assignments) {
      // Positions are kept one per vehicle now; the job a ping was filed under
      // can be the previous one, so fall back to the driver's latest.
      const location = byAssignment.get(assignment.id) ?? (assignment.driverId ? byDriver.get(assignment.driverId) : undefined);
      if (location) locationFor[assignment.id] = { recordedAt: location.recordedAt, sharingEvent: location.sharingEvent, metadata: location.metadata };
    }
    // Each unit's day today, for overtime against its scheduled clock-out.
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(now));
    const missionById = new Map(missions.map((mission) => [mission.id, mission]));
    const todayByUnit = new Map<string, Assignment[]>();
    for (const assignment of assignments) {
      if (!assignment.callSignId || !assignment.startTime || ["cancelled", "archived"].includes(assignment.status)) continue;
      if (new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(assignment.startTime)) !== today) continue;
      todayByUnit.set(assignment.callSignId, [...(todayByUnit.get(assignment.callSignId) ?? []), assignment]);
    }
    const units: AlertUnitDay[] = [];
    for (const [unitId, unitJobs] of todayByUnit) {
      const first = [...unitJobs].sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)))[0];
      const mission = first.missionId ? missionById.get(first.missionId) : undefined;
      const vehicle = first.vehicleId ? vehicleById.get(first.vehicleId) : undefined;
      const day = unitDutyDay({
        date: today,
        schedule: readDutySchedule(mission?.metadata as Record<string, unknown> | undefined),
        jobs: unitJobs,
        session: comms.workSessions[first.id],
        now,
        vehicleMetadata: vehicle?.metadata as Record<string, unknown> | undefined
      });
      if (day) units.push({ unitId, label: callSignById.get(unitId) || unitId.slice(0, 6), assignmentId: first.id, day });
    }
    return computeControlAlerts({ jobs, reported: comms.statuses, sessions: comms.workSessions, locations: locationFor, units, now });
  }, [assignments, callSigns, comms.statuses, comms.workSessions, locations, missions, now, vehicles]);

  // Announce each alert once (per browser, for half a day).
  useEffect(() => {
    if (!alerts.length) return;
    const seen = readJson<Record<string, number>>(seenKey(projectId), {});
    const cutoff = Date.now() - SEEN_TTL_MS;
    for (const [id, at] of Object.entries(seen)) if (at < cutoff) delete seen[id];
    const fresh = alerts.filter((alert) => !seen[alert.id]);
    if (!fresh.length) return;
    for (const alert of fresh) seen[alert.id] = Date.now();
    writeJson(seenKey(projectId), seen);

    const danger = fresh.some((alert) => alert.severity === "danger");
    if (soundOn && audioRef.current) {
      try {
        beep(audioRef.current, danger);
      } catch {
        /* audio blocked — the bar still shows */
      }
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
      const first = fresh[0];
      const notification = new Notification(fresh.length > 1 ? `${first.title} และอีก ${fresh.length - 1} รายการ` : first.title, {
        body: first.detail,
        tag: `tomp-${projectId}`
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
    setOpen(true);
  }, [alerts, projectId, soundOn]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    writeJson(SOUND_KEY, next);
    if (next) {
      // Browsers only allow audio after a click — this is that click.
      audioRef.current ??= new AudioContext();
      void audioRef.current.resume();
      beep(audioRef.current, false);
    }
  }

  async function askPermission() {
    if (typeof Notification === "undefined") return;
    setPermission(await Notification.requestPermission());
  }

  // Re-create the audio context after a reload once sound is on and the user clicks anywhere.
  useEffect(() => {
    if (!soundOn || audioRef.current) return;
    const unlock = () => {
      audioRef.current ??= new AudioContext();
      void audioRef.current.resume();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, [soundOn]);

  const visible = alerts.filter((alert) => !dismissed.has(alert.id));
  const dangerCount = visible.filter((alert) => alert.severity === "danger").length;

  return (
    <section
      className={`sticky top-2 z-20 overflow-hidden rounded-panel border shadow-sm ${
        visible.length ? (dangerCount ? "border-rose-300 bg-rose-50" : "border-amber-300 bg-amber-50") : "border-slate-200 bg-white"
      }`}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <button type="button" onClick={() => setOpen((current) => !current)} className="flex min-w-0 items-center gap-2 text-left">
          {visible.length ? <BellRing className={`h-4 w-4 ${dangerCount ? "text-rose-700" : "text-amber-700"}`} /> : <Bell className="h-4 w-4 text-slate-400" />}
          <span className="text-sm font-semibold text-ink">
            {visible.length ? `แจ้งเตือน ${visible.length} รายการ${dangerCount ? ` · ด่วน ${dangerCount}` : ""}` : "ไม่มีแจ้งเตือน"}
          </span>
          {visible.length ? <ChevronDown className={`h-4 w-4 text-ink-faint transition ${open ? "rotate-180" : ""}`} /> : null}
        </button>
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={soundOn}
            className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-soft"
          >
            {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />} {soundOn ? "เสียงเปิด" : "เปิดเสียง"}
          </button>
          {permission === "default" ? (
            <button
              type="button"
              onClick={askPermission}
              className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-soft"
            >
              <Bell className="h-3.5 w-3.5" /> แจ้งเตือนบนเดสก์ท็อป
            </button>
          ) : permission === "denied" ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint" title="เปิดได้ที่การตั้งค่าเว็บไซต์ของเบราว์เซอร์">
              <BellOff className="h-3.5 w-3.5" /> เบราว์เซอร์ปิดการแจ้งเตือน
            </span>
          ) : null}
        </span>
      </div>
      {open && visible.length ? (
        <ul className="grid max-h-60 gap-1 overflow-y-auto border-t border-black/5 px-3 py-2">
          {visible.map((alert) => (
            <li key={alert.id} className="flex items-start justify-between gap-2 text-[13px]">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COMMS_EVENT, { detail: { assignmentId: alert.assignmentId } }))}
                className="min-w-0 text-left"
                title="เปิดแชทกับคนขับ"
              >
                <span className={`font-semibold ${alert.severity === "danger" ? "text-rose-800" : "text-amber-900"}`}>{alert.title}</span>
                <span className="text-ink-soft"> — {alert.detail}</span>
              </button>
              <button
                type="button"
                onClick={() => setDismissed((current) => new Set(current).add(alert.id))}
                aria-label="ซ่อนรายการนี้"
                className="shrink-0 text-ink-faint hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
