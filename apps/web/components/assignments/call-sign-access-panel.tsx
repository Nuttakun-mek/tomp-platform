"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy, ExternalLink, Eye, LockKeyhole, QrCode, RefreshCw, Trash2, Undo2 } from "lucide-react";
import type { Assignment, CallSign, Driver, Vehicle } from "@tomp/types/domain";
import { deleteCallSignAction, revokeCallSignQrAction } from "@/app/actions/call-signs";
import { createDriverAccessTokenAction } from "@/app/actions/driver-access";
import { createObserverAccessTokenAction } from "@/app/actions/observer-access";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { UnitCredentialSheet, type UnitCredentials } from "./unit-credential-sheet";
import { isUrgentMeta, orderDriverJobs } from "@/lib/domain/driver-day-order";
import { formatStatusTh } from "@/lib/i18n/status-th";
import type { ProjectObserverLink } from "@/lib/data/observer-access";

// Access is issued per crewed unit, not per job: one Call Sign is one driver in
// one vehicle, and that is the thing a QR should name. Issuing per job was what
// filled Mission Control with duplicate cards and stranded job history on old
// tokens — see docs/11-codex/967.

interface UnitJob {
  id: string;
  status: string;
  clock: string;
  route: string;
}

interface Unit {
  callSign: CallSign;
  driver?: Driver;
  vehicle?: Vehicle;
  /** A job on this unit, needed because the token still records one for compatibility. */
  anchorAssignmentId: string | null;
  jobs: UnitJob[];
  /** Cancelled or archived work. Hidden from the list but it still blocks a delete. */
  retiredJobs: number;
}


async function renderQr(url: string, width = 240) {
  const QRCode = await import("qrcode");
  return QRCode.toDataURL(url, { margin: 2, width, errorCorrectionLevel: "M" });
}

function ProjectFleetAccessCard({
  projectId,
  callSigns,
  projectObserverLink
}: {
  projectId: string;
  callSigns: CallSign[];
  projectObserverLink?: ProjectObserverLink | null;
}) {
  // Seeded from the live link, so the card describes the link that exists rather
  // than an empty form beside it. Changing a box and pressing the ordinary button
  // does nothing to the live link — only "ออกลิงก์ใหม่" applies it.
  const [withPin, setWithPin] = useState(Boolean(projectObserverLink?.hasPin));
  const [showCrew, setShowCrew] = useState(Boolean(projectObserverLink?.showCrew));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [url, setUrl] = useState("");
  const [pin, setPin] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "warning" | "danger">("success");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setWithPin(Boolean(projectObserverLink?.hasPin));
    setShowCrew(Boolean(projectObserverLink?.showCrew));
  }, [projectObserverLink?.hasPin, projectObserverLink?.showCrew]);

  useEffect(() => {
    if (!projectObserverLink?.token) return;
    const nextUrl = `${window.location.origin}/fleet/${encodeURIComponent(projectObserverLink.token)}`;
    setUrl(nextUrl);
    renderQr(nextUrl, 220).then(setQr).catch(() => setQr(null));
  }, [projectObserverLink?.token]);

  function toggle(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function issueProjectLink(reissue = false) {
    setMessage(null);
    startTransition(async () => {
      const result = await createObserverAccessTokenAction({
        projectId,
        scope: "project",
        withPin,
        showCrew,
        reissue,
        callSignIds: selectedIds.size ? Array.from(selectedIds) : undefined,
        label: "ลิงก์ติดตามทั้งโครงการ"
      });

      if (!result.success) {
        setTone("danger");
        setMessage(result.error || "สร้างลิงก์ติดตามทั้งโครงการไม่สำเร็จ");
        return;
      }

      const data = result.data as { accessUrl?: string; pin?: string | null; reused?: boolean };
      const nextUrl = data.accessUrl || "";
      setUrl(nextUrl);
      setPin(data.pin ?? null);
      setQr(nextUrl ? await renderQr(nextUrl, 220).catch(() => null) : null);
      setTone(data.reused ? "warning" : "success");
      setMessage(
        data.reused
          ? "แสดงลิงก์ติดตามโครงการเดิมที่ยังใช้งานได้ หากต้องการเปลี่ยน PIN หรือขอบเขต ให้กดออกลิงก์ใหม่"
          : "สร้างลิงก์ติดตามโครงการแล้ว ลิงก์นี้อ่านอย่างเดียวและไม่สามารถแก้ไขงานได้"
      );
    });
  }

  return (
    <section className="rounded-card border border-teal-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-label">Fleet View</p>
          <h3 className="mt-1 text-lg font-bold text-ink">ลิงก์ติดตามรถทั้งโครงการ</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
            ใช้สำหรับลูกค้าหรือผู้ติดตามภายนอก เปิดดูตำแหน่งรถที่ได้รับอนุญาตแบบอ่านอย่างเดียว ไม่แสดงเบอร์โทรคนขับ
          </p>
        </div>
        {projectObserverLink ? (
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">มีลิงก์ใช้งานอยู่</span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-ink-soft">
              <input type="checkbox" checked={withPin} onChange={(event) => setWithPin(event.target.checked)} className="h-4 w-4 accent-teal-600" />
              <LockKeyhole className="h-4 w-4" />
              ใช้ PIN สำหรับลิงก์นี้
            </label>
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-ink-soft">
              <input type="checkbox" checked={showCrew} onChange={(event) => setShowCrew(event.target.checked)} className="h-4 w-4 accent-teal-600" />
              แสดงชื่อคนขับ
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold text-slate-500">จำกัดเฉพาะบาง Call Sign (ไม่เลือก = ทั้งโครงการ)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {callSigns.filter((callSign) => callSign.status === "active").map((callSign) => (
                <button
                  key={callSign.id}
                  type="button"
                  onClick={() => toggle(callSign.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    selectedIds.has(callSign.id) ? "bg-teal-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
                  }`}
                >
                  {callSign.callSign}
                </button>
              ))}
            </div>
          </div>

          {message ? <ActionFeedback tone={tone} message={message} /> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => issueProjectLink(false)}
              className="inline-flex min-h-10 items-center gap-2 rounded-command bg-operation px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              <QrCode className="h-4 w-4" />
              {projectObserverLink || url ? "แสดงลิงก์เดิม" : "สร้างลิงก์ติดตามโครงการ"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => issueProjectLink(true)}
              className="inline-flex min-h-10 items-center gap-2 rounded-command border border-slate-300 bg-white px-4 text-sm font-bold text-ink-soft disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              ออกลิงก์ใหม่
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- QR is a generated data URL, not a remote image asset.
            <img src={qr} alt="QR Fleet View" className="mx-auto h-44 w-44 rounded-xl bg-white p-2" />
          ) : (
            <div className="grid h-44 place-items-center rounded-xl bg-white text-sm font-semibold text-slate-400">ยังไม่มี QR</div>
          )}
          {pin ? (
            <div className="mt-2 rounded-xl border border-amber-400 bg-amber-50 px-3 py-2 text-left">
              <p className="text-[10px] font-bold text-amber-900">รหัส PIN ของลิงก์นี้ (แสดงครั้งเดียว)</p>
              <p className="text-center text-2xl font-bold leading-tight tracking-[0.25em] text-amber-900">{pin}</p>
              <p className="mt-1 text-[10px] leading-4 text-amber-800">
                บันทึกหรือจดเดี๋ยวนี้ ก่อนปิดหรือรีเฟรชหน้านี้ — รหัสนี้เก็บเป็นค่าเข้ารหัสและจะไม่แสดงอีก ถ้าพลาดต้องกด “ออกลิงก์ใหม่” ซึ่งลิงก์เดิมจะใช้ไม่ได้ทันที · ส่งรหัสคนละช่องทางกับ QR
              </p>
            </div>
          ) : null}
          {!pin && projectObserverLink?.hasPin ? (
            <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-600">
              ลิงก์นี้มี PIN อยู่แล้ว แต่แสดงซ้ำไม่ได้ — ถ้าลืม ให้กด “ออกลิงก์ใหม่”
            </p>
          ) : null}
          {url ? (
            <div className="mt-2 grid gap-2">
              <p className="break-all rounded-xl bg-white px-3 py-2 text-[11px] text-slate-600">{url}</p>
              <div className="flex justify-center gap-2">
                <button type="button" className="rounded-full bg-white p-2 text-slate-600 ring-1 ring-slate-200" onClick={() => navigator.clipboard.writeText(url)}>
                  <Copy className="h-4 w-4" />
                </button>
                <a className="rounded-full bg-white p-2 text-slate-600 ring-1 ring-slate-200" href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}


/** "09:30 – 12:00", or a dash when the job has no times yet. */
function clockRange(start?: string | null, end?: string | null) {
  const time = (value?: string | null) => (value ? String(value).slice(11, 16) : "");
  const from = time(start);
  const to = time(end);
  if (from && to) return `${from} – ${to}`;
  return from || to || "ยังไม่ระบุเวลา";
}


const UNIT_ACCENTS = [
  { spine: "bg-teal-500", chip: "bg-teal-600" },
  { spine: "bg-indigo-500", chip: "bg-indigo-600" },
  { spine: "bg-amber-500", chip: "bg-amber-600" },
  { spine: "bg-rose-500", chip: "bg-rose-600" },
  { spine: "bg-sky-500", chip: "bg-sky-600" },
  { spine: "bg-violet-500", chip: "bg-violet-600" }
];

/** Stable per call sign, so a unit keeps its colour across refreshes. */
function accentFor(callSign: string) {
  let hash = 0;
  for (const char of callSign) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return UNIT_ACCENTS[hash % UNIT_ACCENTS.length];
}

/** What an operator needs to tell one vehicle from another, without opening it. */
function detailRows(unit: Unit): Array<{ label: string; value: string }> {
  const vehicleMeta = (unit.vehicle?.metadata ?? {}) as Record<string, unknown>;
  const driverMeta = (unit.driver?.metadata ?? {}) as Record<string, unknown>;
  const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : "");

  const brand = [str(vehicleMeta.brand), str(vehicleMeta.model)].filter(Boolean).join(" ");
  const rows: Array<{ label: string; value: string }> = [
    { label: "ทะเบียน", value: unit.vehicle?.plateNumber ?? "—" },
    { label: "ประเภทรถ", value: unit.vehicle?.vehicleType ?? "—" },
    { label: "ที่นั่ง", value: unit.vehicle?.capacity ? `${unit.vehicle.capacity}` : "—" },
    { label: "ยี่ห้อ/รุ่น", value: brand || "—" },
    { label: "สี", value: str(vehicleMeta.colour) || "—" },
    { label: "สัมภาระ", value: str(vehicleMeta.luggageCapacity) || "—" },
    { label: "คนขับ", value: unit.driver?.fullName ?? "—" },
    { label: "เบอร์โทร", value: unit.driver?.phone || "—" },
    { label: "ใบขับขี่", value: [unit.driver?.licenseType, str(driverMeta.licenseNumber)].filter(Boolean).join(" ") || "—" }
  ];
  return rows;
}

export function CallSignAccessPanel({
  projectId,
  assignments,
  callSigns,
  drivers,
  vehicles,
  issued = {},
  observerLinks = {},
  projectObserverLink,
  onIssued
}: {
  projectId: string;
  assignments: Assignment[];
  callSigns: CallSign[];
  drivers: Driver[];
  vehicles: Vehicle[];
  /** Credentials issued this session, keyed by unit — the PIN lives only here. */
  issued?: Record<string, UnitCredentials>;
  /**
   * The live passenger link per unit, read from the database on the server.
   *
   * The driver token cannot appear here and never will: it is stored as a hash,
   * so after a reload there is genuinely nothing to draw. The observer link is
   * read-only and is kept in the clear for exactly this reason (0036), which is
   * why the passenger QR survives a refresh and the driver's does not.
   */
  observerLinks?: Record<string, string>;
  projectObserverLink?: ProjectObserverLink | null;
  onIssued?: (credentials: UnitCredentials) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "warning" | "danger">("success");
  // Set when the server says a live QR already exists: reissuing kills whatever
  // is already printed, so it takes a second, deliberate press.
  const [confirmReissue, setConfirmReissue] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // Collapsed by default once there are enough units to make the page long.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  // Passenger QR codes drawn from the links already in the database, so the
  // card is complete at load instead of only in the tab that issued it.
  const [storedObserverQr, setStoredObserverQr] = useState<Record<string, string>>({});
  const router = useRouter();

  const observerUrls = useMemo(() => {
    // The row holds the token; the link is that token on this origin. Built on
    // the client so the server does not have to know its own public URL here.
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const map: Record<string, string> = {};
    for (const [callSignId, token] of Object.entries(observerLinks)) {
      if (token) map[callSignId] = `${origin}/track/${encodeURIComponent(token)}`;
    }
    return map;
  }, [observerLinks]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const drawn: Record<string, string> = {};
      for (const [callSignId, url] of Object.entries(observerUrls)) {
        const image = await renderQr(url).catch(() => null);
        if (image) drawn[callSignId] = image;
      }
      if (!cancelled && Object.keys(drawn).length) setStoredObserverQr(drawn);
    })();
    return () => {
      cancelled = true;
    };
  }, [observerUrls]);

  const units = useMemo<Unit[]>(() => {
    const driverById = new Map(drivers.map((d) => [d.id, d]));
    const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
    const live = assignments.filter((a) => !["cancelled", "archived"].includes(a.status));

    return callSigns
      .filter((cs) => cs.status === "active")
      .map((cs) => {
        const jobs = live.filter((a) => a.callSignId === cs.id);
        const retiredJobs = assignments.filter(
          (a) => a.callSignId === cs.id && ["cancelled", "archived"].includes(a.status)
        ).length;
        // Prefer the job actually running; otherwise any job will do — the token
        // only needs one to point at.
        const anchor = jobs.find((a) => a.status === "active") ?? jobs[0];
        // Same running order the driver's own screen uses, so the control room
        // and the driver never disagree about what comes next.
        const ordered = orderDriverJobs(
          jobs.map((a) => ({
            id: a.id,
            status: a.status,
            startTime: a.startTime ?? null,
            createdAt: a.createdAt ?? null,
            sequence: typeof a.metadata.sequence === "number" ? (a.metadata.sequence as number) : null,
            urgent: isUrgentMeta(a.metadata),
            isCurrent: a.status === "active"
          }))
        );
        const byId = new Map(jobs.map((a) => [a.id, a]));
        return {
          callSign: cs,
          driver: cs.driverId ? driverById.get(cs.driverId) : undefined,
          vehicle: cs.vehicleId ? vehicleById.get(cs.vehicleId) : undefined,
          anchorAssignmentId: anchor?.id ?? null,
          retiredJobs,
          jobs: ordered.map((job) => {
            const row = byId.get(job.id);
            const meta = (row?.metadata ?? {}) as Record<string, unknown>;
            const pickup = typeof meta.pickupLocation === "string" ? meta.pickupLocation : "ยังไม่ระบุจุดรับ";
            const dropoff = typeof meta.dropoffLocation === "string" ? meta.dropoffLocation : "ยังไม่ระบุจุดส่ง";
            return {
              id: job.id,
              status: job.status,
              clock: clockRange(row?.startTime, row?.endTime),
              route: `${pickup} → ${dropoff}`
            };
          })
        };
      })
      .sort((a, b) => a.callSign.callSign.localeCompare(b.callSign.callSign, "th"));
  }, [assignments, callSigns, drivers, vehicles]);

  const ready = units.filter((u) => u.driver && u.vehicle);

  function issue(unit: Unit, replaceExisting: boolean) {
    setMessage(null);
    startTransition(async () => {
      const result = await createDriverAccessTokenAction({
        projectId,
        callSignId: unit.callSign.id,
        driverId: unit.callSign.driverId || null,
        replaceExisting
      });

      if (!result.success) {
        // The refusal carries the Call Sign, which is how we know to offer the
        // deliberate reissue rather than just showing an error.
        const blocked = (result.fieldErrors?.callSignId ?? [])[0];
        if (blocked) {
          setConfirmReissue(unit.callSign.id);
          setTone("warning");
          setMessage(result.error || "Call Sign นี้มี QR ที่ใช้งานอยู่แล้ว");
          return;
        }
        setConfirmReissue(null);
        setTone("danger");
        setMessage(result.error || "ออก QR ไม่สำเร็จ");
        return;
      }

      const data = result.data as { accessUrl?: string; pin?: string };
      const accessUrl = data.accessUrl || "";
      setConfirmReissue(null);
      const qr = accessUrl ? await renderQr(accessUrl) : null;
      onIssued?.({
        callSignId: unit.callSign.id,
        callSignLabel: unit.callSign.callSign,
        driverName: unit.driver?.fullName ?? "ไม่ทราบชื่อคนขับ",
        vehicleLabel: unit.vehicle ? `${unit.vehicle.plateNumber} · ${unit.vehicle.vehicleType}` : "ไม่ทราบรถ",
        driverUrl: accessUrl,
        driverQr: qr,
        pin: data.pin || null,
        observerUrl: issued[unit.callSign.id]?.observerUrl ?? "",
        observerQr: issued[unit.callSign.id]?.observerQr ?? null
      });
      setExpanded((current) => new Set(current).add(unit.callSign.id));
      setTone("success");
      setMessage(
        replaceExisting
          ? "ออก QR ใบใหม่แล้ว ใบเดิมและรหัสเดิมใช้ไม่ได้อีก กรุณาแจ้งคนขับ"
          : "ออก QR และรหัสสำเร็จ ส่ง QR กับรหัสคนละช่องทาง"
      );
    });
  }

  // Pairing the wrong person to the wrong vehicle is easy and the fix has to be
  // easy too — but not so easy that a unit with a QR already in someone's hand
  // disappears from under them, so the QR is revoked first, deliberately.
  function revokeQr(unit: Unit) {
    setMessage(null);
    startTransition(async () => {
      const result = await revokeCallSignQrAction({ projectId, callSignId: unit.callSign.id });
      setTone(result.success ? "success" : "danger");
      setMessage(result.success ? "ยกเลิก QR ของหน่วยนี้แล้ว ใบเดิมใช้ไม่ได้อีก" : result.error || "ยกเลิก QR ไม่สำเร็จ");
      if (result.success) router.refresh();
    });
  }

  function removeUnit(unit: Unit) {
    setMessage(null);
    startTransition(async () => {
      const result = await deleteCallSignAction({ projectId, callSignId: unit.callSign.id });
      setTone(result.success ? "success" : "danger");
      setMessage(result.success ? `ลบหน่วย ${unit.callSign.callSign} แล้ว` : result.error || "ลบหน่วยรถไม่สำเร็จ");
      if (result.success) {
        setConfirmDelete(null);
        router.refresh();
      }
    });
  }

  /**
   * What the unit's sheet should show right now.
   *
   * The two halves have different lifetimes and the card has to be honest about
   * that: the driver half exists only in this tab until the page is reloaded,
   * the passenger half is read back from the database every time. Merging them
   * here is what stopped the sheet showing one half and claiming the other was
   * never issued.
   */
  function sheetFor(unit: Unit): UnitCredentials | null {
    const live = issued[unit.callSign.id];
    const storedUrl = observerUrls[unit.callSign.id] ?? "";
    const storedQr = storedObserverQr[unit.callSign.id] ?? null;
    if (!live && !storedUrl) return null;
    return {
      callSignId: unit.callSign.id,
      callSignLabel: unit.callSign.callSign,
      driverName: live?.driverName ?? unit.driver?.fullName ?? "ไม่ทราบชื่อคนขับ",
      vehicleLabel:
        live?.vehicleLabel ??
        (unit.vehicle ? `${unit.vehicle.plateNumber} · ${unit.vehicle.vehicleType}` : "ไม่ทราบรถ"),
      driverUrl: live?.driverUrl ?? "",
      driverQr: live?.driverQr ?? null,
      pin: live?.pin ?? null,
      observerUrl: live?.observerUrl || storedUrl,
      observerQr: live?.observerQr || storedQr
    };
  }

  function issueObserverLink(unit: Unit) {
    setMessage(null);
    startTransition(async () => {
      const result = await createObserverAccessTokenAction({ projectId, callSignId: unit.callSign.id });
      if (!result.success) {
        setTone("danger");
        setMessage(result.error || "สร้างลิงก์ไม่สำเร็จ");
        return;
      }
      const data = result.data as { trackUrl?: string; accessUrl?: string; reused?: boolean };
      const url = data.trackUrl || data.accessUrl || "";

      // This used to stop at the URL and render it as text, so the button called
      // "ลิงก์ผู้โดยสาร" produced no QR at all — the one thing a passenger can
      // actually use. It goes onto the same sheet as the driver's.
      const existing = issued[unit.callSign.id];
      onIssued?.({
        callSignId: unit.callSign.id,
        callSignLabel: unit.callSign.callSign,
        driverName: unit.driver?.fullName ?? "ไม่ทราบชื่อคนขับ",
        vehicleLabel: unit.vehicle ? `${unit.vehicle.plateNumber} · ${unit.vehicle.vehicleType}` : "ไม่ทราบรถ",
        driverUrl: existing?.driverUrl ?? "",
        driverQr: existing?.driverQr ?? null,
        pin: existing?.pin ?? null,
        observerUrl: url,
        observerQr: url ? await renderQr(url) : null
      });
      setExpanded((current) => new Set(current).add(unit.callSign.id));
      setTone("success");
      setMessage(
        data.reused
          ? "แสดง QR ผู้โดยสารใบเดิม ลิงก์นี้ยังใช้งานได้ ไม่ได้ออกใบใหม่"
          : "สร้าง QR ผู้โดยสาร/ผู้ติดตามแล้ว ลิงก์นี้ดูตำแหน่งได้อย่างเดียว แก้ไขงานไม่ได้"
      );
      // A new link is now in the database; refresh so it is redrawn from there
      // on the next load rather than living only in this tab.
      if (!data.reused) router.refresh();
    });
  }

  return (
    <section className="enterprise-panel-soft border-route/20 bg-blue-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-blue-950">หน่วยรถในโครงการนี้</h2>
          <p className="mt-1 text-sm leading-6 text-blue-900">
            แต่ละหน่วยเก็บ QR ของตัวเองและงานทั้งหมดที่ได้รับ เรียงตามเวลา — กดหัวการ์ดเพื่อย่อหรือขยาย
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800 shadow-sm">
          {ready.length}/{units.length} หน่วยพร้อมออก QR
        </span>
      </div>


      {message ? (
        <div className="mt-3">
          <ActionFeedback tone={tone} message={message} />
        </div>
      ) : null}

      <div className="mt-4">
        <ProjectFleetAccessCard projectId={projectId} callSigns={callSigns} projectObserverLink={projectObserverLink} />
      </div>

      <div className="mt-3 grid gap-2.5">
        {units.length === 0 ? (
          <p className="rounded-card bg-white px-3 py-4 text-center text-[13px] text-ink-soft">
            ยังไม่มี Call Sign ในโครงการนี้ สร้าง Call Sign และจับคู่คนขับกับรถก่อน
          </p>
        ) : null}

        {units.map((unit) => {
          const crewed = Boolean(unit.driver && unit.vehicle);
          const needsConfirm = confirmReissue === unit.callSign.id;
          const hasIssuedSheet = Boolean(issued[unit.callSign.id]);
          const sheet = sheetFor(unit);
          const hasObserverLink = Boolean(observerUrls[unit.callSign.id]);
          const open = expanded.has(unit.callSign.id);
          const accent = accentFor(unit.callSign.callSign);

          return (
            <article
              key={unit.callSign.id}
              className={`relative overflow-hidden rounded-card bg-white shadow-sm ring-1 ${
                open ? "ring-2 ring-operation/30" : "ring-black/5"
              }`}
            >
              <span className={`absolute inset-y-0 left-0 w-1.5 ${accent.spine}`} aria-hidden />
              <button
                type="button"
                onClick={() =>
                  setExpanded((current) => {
                    const next = new Set(current);
                    if (next.has(unit.callSign.id)) next.delete(unit.callSign.id);
                    else next.add(unit.callSign.id);
                    return next;
                  })
                }
                className="flex w-full flex-wrap items-center justify-between gap-2 py-3 pl-4 pr-3 text-left"
              >
                <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span className={`rounded-lg px-2 py-1 text-[12px] font-bold text-white ${accent.chip}`}>
                    {unit.callSign.callSign}
                  </span>
                  <span className="text-[14px] font-bold text-ink">{unit.vehicle?.plateNumber ?? "ยังไม่ผูกรถ"}</span>
                  <span className="text-[12px] text-ink-soft">
                    {unit.vehicle?.vehicleType ?? "—"}
                    {unit.vehicle?.capacity ? ` · ${unit.vehicle.capacity} ที่นั่ง` : ""}
                  </span>
                  <span className="text-[12px] text-ink-soft">คนขับ {unit.driver?.fullName ?? "—"}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {issued[unit.callSign.id] ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                      มีรหัสใหม่ ยังไม่ได้บันทึก
                    </span>
                  ) : null}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                    {unit.jobs.length} งาน
                    {unit.retiredJobs ? ` · ยกเลิก ${unit.retiredJobs}` : ""}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-ink-faint transition ${open ? "rotate-180" : ""}`} />
                </span>
              </button>

              {open ? (
              <div className="grid gap-3 border-t border-black/5 py-3 pl-4 pr-3">
              <dl className="grid gap-x-4 gap-y-1 text-[12px] sm:grid-cols-2 lg:grid-cols-3">
                {detailRows(unit).map((row) => (
                  <div key={row.label} className="flex gap-1.5">
                    <dt className="shrink-0 font-semibold text-ink-faint">{row.label}</dt>
                    <dd className="min-w-0 truncate text-ink-soft">{row.value}</dd>
                  </div>
                ))}
              </dl>

              {sheet ? <UnitCredentialSheet credentials={sheet} /> : null}

              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={isPending || !crewed}
                    onClick={() => issue(unit, needsConfirm)}
                    className={`flex min-h-9 items-center gap-1.5 rounded-command px-3 text-[12px] font-semibold text-white disabled:opacity-40 ${
                      needsConfirm || hasIssuedSheet ? "bg-amber-600" : "bg-route"
                    }`}
                  >
                    {needsConfirm ? <RefreshCw className="h-3.5 w-3.5" /> : <QrCode className="h-3.5 w-3.5" />}
                    {needsConfirm ? "ยืนยันออก QR ใหม่" : hasIssuedSheet ? "ออก QR ใหม่" : "ออก QR"}
                  </button>
                  <button
                    type="button"
                    disabled={isPending || !crewed}
                    onClick={() => issueObserverLink(unit)}
                    title={
                      hasObserverLink
                        ? "แสดง QR ผู้โดยสารใบเดิมที่ยังใช้งานได้"
                        : "สร้าง QR สำหรับผู้โดยสาร/ผู้ติดตาม ดูตำแหน่งได้อย่างเดียว"
                    }
                    className="flex min-h-9 items-center gap-1.5 rounded-command border border-slate-300 bg-white px-3 text-[12px] font-semibold text-ink-soft disabled:opacity-40"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {hasObserverLink ? "แสดง QR ผู้โดยสาร" : "สร้าง QR ผู้โดยสาร/ผู้ติดตาม"}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => revokeQr(unit)}
                    title="ยกเลิก QR ที่ออกไปแล้วของหน่วยนี้"
                    className="flex min-h-9 items-center gap-1.5 rounded-command border border-slate-300 bg-white px-3 text-[12px] font-semibold text-ink-soft disabled:opacity-40"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> ยกเลิก QR
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => (confirmDelete === unit.callSign.id ? removeUnit(unit) : setConfirmDelete(unit.callSign.id))}
                    className={`flex min-h-9 items-center gap-1.5 rounded-command px-3 text-[12px] font-semibold disabled:opacity-40 ${
                      confirmDelete === unit.callSign.id
                        ? "bg-rose-600 text-white"
                        : "border border-rose-200 bg-white text-rose-700"
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {confirmDelete === unit.callSign.id ? "ยืนยันลบ — QR จะใช้ไม่ได้" : "ลบหน่วย"}
                  </button>
                </div>
              </div>

              {!crewed ? (
                <p className="mt-2 rounded-card bg-amber-50 px-2.5 py-1.5 text-[12px] font-semibold text-amber-800">
                  ยังออก QR ไม่ได้ — ต้องผูก{!unit.driver ? "คนขับ" : ""}
                  {!unit.driver && !unit.vehicle ? " และ" : ""}
                  {!unit.vehicle ? "รถ" : ""}ให้ Call Sign นี้ก่อน
                </p>
              ) : null}

              {/* Item 5: work shows up under the unit it was given to, right
                  after it is added, instead of only as a number. */}
              {unit.jobs.length ? (
                <ol className="mt-2 grid gap-1 border-t border-black/5 pt-2">
                  {unit.jobs.map((job, index) => (
                    <li key={job.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-ink-soft">
                        {index + 1}
                      </span>
                      <span className="font-semibold text-ink">{job.clock}</span>
                      <span className="min-w-0 flex-1 truncate text-ink-soft">{job.route}</span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">
                        {formatStatusTh(job.status)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : crewed ? (
                <p className="mt-2 rounded-card bg-slate-100 px-2.5 py-1.5 text-[12px] text-ink-soft">
                  ยังไม่มีงานสำหรับหน่วยนี้ เพิ่มได้ที่ “ขั้นที่ 2” ด้านล่าง
                </p>
              ) : null}


              </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
