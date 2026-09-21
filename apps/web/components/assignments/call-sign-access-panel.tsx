"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy, ExternalLink, LockKeyhole, QrCode, RefreshCw, Trash2, Undo2 } from "lucide-react";
import type { Assignment, CallSign, Driver, Vehicle } from "@tomp/types/domain";
import { deleteCallSignAction, revokeCallSignQrAction } from "@/app/actions/call-signs";
import { createDriverAccessTokenAction } from "@/app/actions/driver-access";
import { createObserverAccessTokenAction } from "@/app/actions/observer-access";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { DateTimeField } from "@/components/ui/datetime-field";
import { UnitCredentialSheet, type UnitCredentials } from "./unit-credential-sheet";
import { isUrgentMeta, orderDriverJobs } from "@/lib/domain/driver-day-order";
import { latestEvidenceByDriver } from "@/lib/domain/driver-evidence";
import { formatObserverExpiryLabel } from "@/lib/domain/observer-expiry";
import { formatStatusTh } from "@/lib/i18n/status-th";
import { accentFor } from "@/lib/ui/unit-accent";
import type { ProjectObserverLink } from "@/lib/data/observer-access";
import type { VehicleEvidence } from "@/lib/data/vehicle-evidence";

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
  evidence?: VehicleEvidence;
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

function dateInputValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric"
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function endOfBangkokDate(value: string) {
  return value ? `${value}T16:59:59.999Z` : null;
}

function callSignMissionId(callSign: CallSign): string {
  const value = (callSign.metadata as Record<string, unknown> | undefined)?.missionId;
  return typeof value === "string" ? value : "";
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
  const [expiresOn, setExpiresOn] = useState(dateInputValue(projectObserverLink?.expiresAt));
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
    setExpiresOn(dateInputValue(projectObserverLink?.expiresAt));
  }, [projectObserverLink?.expiresAt, projectObserverLink?.hasPin, projectObserverLink?.showCrew]);

  useEffect(() => {
    if (!projectObserverLink?.token) return;
    const nextUrl = `${window.location.origin}/ground-transfer/fleet/${encodeURIComponent(projectObserverLink.token)}`;
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
        expiresAt: endOfBangkokDate(expiresOn),
        label: "ลิงก์ติดตามทั้งโครงการ"
      });

      if (!result.success) {
        setTone("danger");
        setMessage(result.error || "สร้างลิงก์ติดตามทั้งโครงการไม่สำเร็จ");
        return;
      }

      const data = result.data as { accessUrl?: string; pin?: string | null; reused?: boolean; tokenRecord?: { expires_at?: string | null } };
      const nextUrl = data.accessUrl || "";
      const nextExpiry = data.tokenRecord?.expires_at || endOfBangkokDate(expiresOn);
      setUrl(nextUrl);
      setPin(data.pin ?? null);
      setExpiresOn(dateInputValue(nextExpiry));
      setQr(nextUrl ? await renderQr(nextUrl, 220).catch(() => null) : null);
      setTone(data.reused ? "warning" : "success");
      setMessage(
        data.reused
          ? `แสดงลิงก์ติดตามโครงการเดิมที่ยังใช้งานได้ หมดอายุ ${formatObserverExpiryLabel(nextExpiry)} หากต้องการเปลี่ยน PIN ขอบเขต หรือวันหมดอายุ ให้กดออกลิงก์ใหม่`
          : `สร้างลิงก์ติดตามโครงการแล้ว หมดอายุ ${formatObserverExpiryLabel(nextExpiry)} ลิงก์นี้อ่านอย่างเดียวและไม่สามารถแก้ไขงานได้`
      );
    });
  }

  const activeCallSigns = callSigns.filter((callSign) => callSign.status === "active");
  const scopeCount = selectedIds.size;
  const hasLink = Boolean(url);

  // The heading, the description and the "in use" badge now belong to the
  // CollapsibleSection that wraps this, so that folding the section away folds
  // the whole thing. Keeping them here too stacked two headers on one card.
  //
  // One band per step, in the order an operator works through them. The card
  // used to sit the QR in a fixed 240px column beside the form, so a project
  // with no link yet spent a quarter of its width on a grey "ยังไม่มี QR" box,
  // while the three controls were crammed into a three-column grid that wrapped
  // differently at every width. Settings, scope, action, result — and the result
  // only exists once there is one.
  return (
    <div className="grid min-w-0 gap-3">
        <fieldset className="grid min-w-0 gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <legend className="px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">ตั้งค่าลิงก์</legend>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-ink-soft">
              <input type="checkbox" checked={withPin} onChange={(event) => setWithPin(event.target.checked)} className="h-4 w-4 accent-teal-600" />
              <LockKeyhole className="h-4 w-4 shrink-0" />
              <span className="min-w-0 leading-5">ต้องใส่ PIN ก่อนดู</span>
            </label>
            <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-ink-soft">
              <input type="checkbox" checked={showCrew} onChange={(event) => setShowCrew(event.target.checked)} className="h-4 w-4 accent-teal-600" />
              <span className="min-w-0 leading-5">แสดงชื่อคนขับ</span>
            </label>
          </div>

          <div className="grid min-w-0 gap-1.5 sm:grid-cols-[minmax(13rem,16rem)_minmax(0,1fr)] sm:items-start">
            <DateTimeField
              label="วันหมดอายุ"
              name="projectObserverExpiresOn"
              value={expiresOn}
              onChange={setExpiresOn}
              hint="เว้นว่างได้ หากต้องการให้ระบบกำหนดอายุใช้งานให้"
            />
            <p className="min-w-0 text-[12px] leading-5 text-ink-soft">
              {expiresOn
                ? `ใช้ได้ถึง ${formatObserverExpiryLabel(endOfBangkokDate(expiresOn))}`
                : "เว้นว่างไว้ ระบบจะตั้งวันหมดอายุที่ยังใช้งานได้จริงให้เอง"}
            </p>
          </div>
        </fieldset>

        <fieldset className="grid min-w-0 gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <legend className="px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">ขอบเขตที่ลิงก์มองเห็น</legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 text-[12px] leading-5 text-ink-soft">
              {scopeCount
                ? `เลือกไว้ ${scopeCount} หน่วย — ลิงก์นี้จะเห็นเฉพาะหน่วยที่เลือก`
                : "ยังไม่เลือก — ลิงก์นี้จะเห็นรถทุกหน่วยในโครงการ"}
            </p>
            {scopeCount ? (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="shrink-0 rounded-command px-2 py-1 text-[12px] font-bold text-operation underline-offset-2 hover:underline"
              >
                ล้างการเลือก
              </button>
            ) : null}
          </div>
          {activeCallSigns.length ? (
            <div className="flex max-h-28 min-w-0 flex-wrap gap-1.5 overflow-y-auto pr-1">
              {activeCallSigns.map((callSign) => (
                <button
                  key={callSign.id}
                  type="button"
                  onClick={() => toggle(callSign.id)}
                  aria-pressed={selectedIds.has(callSign.id)}
                  className={`inline-flex h-8 max-w-full shrink-0 items-center rounded-full px-3 text-xs font-bold transition ${
                    selectedIds.has(callSign.id) ? "bg-teal-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-teal-300"
                  }`}
                >
                  <span className="truncate">{callSign.callSign}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-white px-3 py-2 text-[12px] text-ink-faint">ยังไม่มีหน่วยรถที่ใช้งานอยู่ในโครงการนี้</p>
          )}
        </fieldset>

        {message ? <ActionFeedback tone={tone} message={message} /> : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => issueProjectLink(false)}
            className="inline-flex h-11 max-w-full shrink-0 items-center justify-center gap-2 rounded-command bg-operation px-4 text-sm font-bold leading-none text-white disabled:opacity-50"
            title={hasLink || projectObserverLink ? "แสดงลิงก์ติดตามโครงการที่ยังใช้งานอยู่" : "สร้างลิงก์ติดตามโครงการ"}
          >
            <QrCode className="h-4 w-4 shrink-0" />
            <span className="truncate">{hasLink || projectObserverLink ? "แสดงลิงก์เดิม" : "สร้างลิงก์ติดตามโครงการ"}</span>
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => issueProjectLink(true)}
            className="inline-flex h-11 max-w-full shrink-0 items-center justify-center gap-2 rounded-command border border-slate-300 bg-white px-4 text-sm font-bold leading-none text-ink-soft disabled:opacity-50"
            title="ออกลิงก์ใหม่เมื่อจำเป็นเท่านั้น เพราะลิงก์เดิมจะถูกยกเลิกทันที"
          >
            <RefreshCw className="h-4 w-4 shrink-0" />
            <span className="truncate">ออกลิงก์ใหม่</span>
          </button>
          <p className="min-w-0 flex-1 text-[11px] leading-4 text-ink-faint">
            การตั้งค่าด้านบนจะมีผลเมื่อกด “ออกลิงก์ใหม่” เท่านั้น — ลิงก์ที่แจกไปแล้วจะไม่เปลี่ยนตาม
          </p>
        </div>

        {hasLink ? (
          <div className="grid min-w-0 items-start gap-3 rounded-xl border border-teal-200 bg-teal-50/50 p-3 sm:grid-cols-[auto_minmax(0,1fr)]">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- QR is a generated data URL, not a remote image asset.
              <img src={qr} alt="QR ลิงก์ติดตามทั้งโครงการ" className="mx-auto h-40 w-40 rounded-xl bg-white p-2" />
            ) : (
              <div className="mx-auto grid h-40 w-40 place-items-center rounded-xl bg-white text-[12px] font-semibold text-slate-400">กำลังสร้าง QR</div>
            )}
            <div className="grid min-w-0 content-start gap-2">
              <p className="text-[12px] font-bold text-teal-900">ลิงก์อ่านอย่างเดียวสำหรับลูกค้าหรือผู้ติดตาม</p>
              <p className="max-h-20 min-w-0 overflow-y-auto break-all rounded-lg bg-white px-3 py-2 text-[11px] leading-4 text-slate-600">{url}</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(url)}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-command border border-slate-300 bg-white px-3 text-[12px] font-semibold leading-none text-ink-soft"
                  title="คัดลอกลิงก์ติดตาม"
                >
                  <Copy className="h-3.5 w-3.5 shrink-0" /> คัดลอกลิงก์
                </button>
                <a
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-command border border-slate-300 bg-white px-3 text-[12px] font-semibold leading-none text-ink-soft"
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  title="เปิดลิงก์ติดตามในแท็บใหม่"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" /> เปิดดู
                </a>
              </div>
              {pin ? (
                <div className="rounded-xl border border-amber-400 bg-amber-50 px-3 py-2">
                  <p className="text-[10px] font-bold text-amber-900">รหัส PIN ของลิงก์นี้ (แสดงครั้งเดียว)</p>
                  <p className="text-center text-2xl font-bold leading-tight tracking-[0.25em] text-amber-900">{pin}</p>
                  <p className="mt-1 text-[10px] leading-4 text-amber-800">
                    บันทึกหรือจดเดี๋ยวนี้ ก่อนปิดหรือรีเฟรชหน้านี้ — รหัสนี้เก็บเป็นค่าเข้ารหัสและจะไม่แสดงอีก ถ้าพลาดต้องกด “ออกลิงก์ใหม่” ซึ่งลิงก์เดิมจะใช้ไม่ได้ทันที · ส่งรหัสคนละช่องทางกับ QR
                  </p>
                </div>
              ) : null}
              {!pin && projectObserverLink?.hasPin ? (
                <p className="rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-slate-600">
                  ลิงก์นี้มี PIN อยู่แล้ว แต่แสดงซ้ำไม่ได้ — ถ้าลืม ให้กด “ออกลิงก์ใหม่”
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-[12px] leading-5 text-ink-soft">
            ยังไม่มีลิงก์ติดตามของโครงการนี้ — ตั้งค่าด้านบนแล้วกด “สร้างลิงก์ติดตามโครงการ”
          </p>
        )}
    </div>
  );
}


/** "20 ก.ย. 2569 09:30 – 12:00", or a clear empty state when the job has no times yet. */
function jobDateTimeRange(start?: string | null, end?: string | null) {
  const parse = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    return date;
  };
  const dateFormatter = new Intl.DateTimeFormat("th-TH", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
  const timeFormatter = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
  const from = parse(start);
  const to = parse(end);
  if (!from && !to) return "ยังไม่ระบุวันและเวลา";
  if (from && !to) return `${dateFormatter.format(from)} ${timeFormatter.format(from)}`;
  if (!from && to) return `${dateFormatter.format(to)} ${timeFormatter.format(to)}`;
  const fromDate = dateFormatter.format(from!);
  const toDate = dateFormatter.format(to!);
  const fromTime = timeFormatter.format(from!);
  const toTime = timeFormatter.format(to!);
  return fromDate === toDate ? `${fromDate} ${fromTime} – ${toTime}` : `${fromDate} ${fromTime} – ${toDate} ${toTime}`;
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
  vehicleEvidence = {},
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
  vehicleEvidence?: Record<string, VehicleEvidence>;
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
      if (token) map[callSignId] = `${origin}/ground-transfer/track/${encodeURIComponent(token)}`;
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
    const evidenceByDriver = latestEvidenceByDriver(vehicleEvidence);
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
        const evidence =
          (cs.driverId ? evidenceByDriver.get(cs.driverId) : undefined) ??
          jobs.map((job) => vehicleEvidence[job.id]).find(Boolean);
        return {
          callSign: cs,
          driver: cs.driverId ? driverById.get(cs.driverId) : undefined,
          vehicle: cs.vehicleId ? vehicleById.get(cs.vehicleId) : undefined,
          evidence,
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
              clock: jobDateTimeRange(row?.startTime, row?.endTime),
              route: `${pickup} → ${dropoff}`
            };
          })
        };
      })
      .sort((a, b) => a.callSign.callSign.localeCompare(b.callSign.callSign, "th"));
  }, [assignments, callSigns, drivers, vehicleEvidence, vehicles]);

  const ready = units.filter((u) => u.driver && u.vehicle && callSignMissionId(u.callSign));

  /**
   * Both halves of a unit's handover, in one press.
   *
   * They used to be two buttons, and each rebuilt the whole sheet out of its
   * own result while copying the other half from whatever happened to be left
   * in this tab. So "ออก QR" returned a sheet carrying only the driver's code,
   * and "สร้าง QR ผู้โดยสาร/ผู้ติดตาม" returned one carrying only the
   * passenger's — and an operator with a driver standing in front of them had
   * to know to press both, in the right order, to get a complete handover.
   * The handover is now a single action for a unit that already exists.
   */
  function issueUnitCredentials(unit: Unit, replaceDriverQr: boolean) {
    setMessage(null);
    startTransition(async () => {
      const [driverResult, observerResult] = await Promise.all([
        createDriverAccessTokenAction({
          projectId,
          callSignId: unit.callSign.id,
          driverId: unit.callSign.driverId || null,
          replaceExisting: replaceDriverQr
        }),
        createObserverAccessTokenAction({ projectId, callSignId: unit.callSign.id })
      ]);

      const driverData = driverResult.success ? (driverResult.data as { accessUrl?: string; pin?: string }) : null;
      const observerData = observerResult.success
        ? (observerResult.data as { accessUrl?: string; trackUrl?: string; reused?: boolean })
        : null;
      const driverUrl = driverData?.accessUrl || "";
      const observerUrl = observerData?.trackUrl || observerData?.accessUrl || "";
      const [driverQr, observerQr] = await Promise.all([
        driverUrl ? renderQr(driverUrl).catch(() => null) : Promise.resolve(null),
        observerUrl ? renderQr(observerUrl).catch(() => null) : Promise.resolve(null)
      ]);

      // A live driver QR is not an error to decode — it is the system refusing
      // to invalidate a code someone is already holding. The passenger half is
      // untouched by that refusal, so it still goes onto the sheet.
      const driverBlocked = !driverResult.success && Boolean((driverResult.fieldErrors?.callSignId ?? [])[0]);
      setConfirmReissue(driverBlocked ? unit.callSign.id : null);

      const previous = issued[unit.callSign.id];
      onIssued?.({
        callSignId: unit.callSign.id,
        callSignLabel: unit.callSign.callSign,
        driverName: unit.driver?.fullName ?? "ไม่ทราบชื่อคนขับ",
        vehicleLabel: unit.vehicle ? `${unit.vehicle.plateNumber} · ${unit.vehicle.vehicleType}` : "ไม่ทราบรถ",
        driverUrl: driverUrl || previous?.driverUrl || "",
        driverQr: driverQr ?? previous?.driverQr ?? null,
        pin: driverData?.pin ?? previous?.pin ?? null,
        observerUrl: observerUrl || previous?.observerUrl || "",
        observerQr: observerQr ?? previous?.observerQr ?? null
      });
      setExpanded((current) => new Set(current).add(unit.callSign.id));

      if (!driverResult.success && !observerResult.success) {
        setTone("danger");
        setMessage(driverResult.error || observerResult.error || "ออก QR ไม่สำเร็จ");
        return;
      }

      if (driverBlocked) {
        setTone("warning");
        setMessage(
          `${driverResult.error || "หน่วยนี้มี QR คนขับที่ยังใช้งานอยู่"} — QR ผู้โดยสารแสดงไว้ให้แล้วด้านล่าง กดยืนยันอีกครั้งถ้าต้องการออก QR คนขับใบใหม่`
        );
        return;
      }

      if (!driverResult.success || !observerResult.success) {
        setTone("warning");
        setMessage(
          driverResult.success
            ? `ออก QR คนขับแล้ว แต่ QR ผู้โดยสารไม่สำเร็จ — ${observerResult.error || "ลองอีกครั้ง"}`
            : `ออก QR ผู้โดยสารแล้ว แต่ QR คนขับไม่สำเร็จ — ${driverResult.error || "ลองอีกครั้ง"}`
        );
        return;
      }

      setTone("success");
      setMessage(
        replaceDriverQr
          ? "ออก QR ใหม่ครบทั้ง 2 ใบแล้ว — ใบคนขับเดิมและรหัสเดิมใช้ไม่ได้อีก กรุณาแจ้งคนขับ"
          : "ออก QR ครบทั้ง 2 ใบแล้ว — ส่ง QR คนขับกับรหัสคนละช่องทาง"
      );
      // A new passenger link is now in the database; refresh so it is redrawn
      // from there on the next load rather than living only in this tab.
      if (!observerData?.reused) router.refresh();
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

      {/* Folded away once a link exists, because issuing it is a thing you do
          once per project and then stop thinking about — but left open while
          there is none, so a new project still sees the step it has not taken.
          CollapsibleSection remembers the operator's own choice after that. */}
      <div className="mt-4">
        <CollapsibleSection
          title="ลิงก์ติดตามรถทั้งโครงการ"
          description="ลิงก์อ่านอย่างเดียวสำหรับลูกค้าหรือผู้ติดตามภายนอก ไม่แสดงเบอร์โทรคนขับ"
          storageKey={`dispatch.${projectId}.fleetlink`}
          defaultOpen={!projectObserverLink}
          badge={
            projectObserverLink ? (
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800">มีลิงก์ใช้งานอยู่</span>
            ) : null
          }
        >
          <ProjectFleetAccessCard projectId={projectId} callSigns={callSigns} projectObserverLink={projectObserverLink} />
        </CollapsibleSection>
      </div>

      <div className="mt-3 grid gap-2.5">
        {units.length === 0 ? (
          <p className="rounded-card bg-white px-3 py-4 text-center text-[13px] text-ink-soft">
            ยังไม่มี Call Sign ในโครงการนี้ สร้าง Call Sign และจับคู่คนขับกับรถก่อน
          </p>
        ) : null}

        {units.map((unit) => {
          const crewed = Boolean(unit.driver && unit.vehicle);
          const missionReady = Boolean(callSignMissionId(unit.callSign));
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

              {unit.evidence && (unit.evidence.vehiclePhotoUrl || unit.evidence.platePhotoUrl) ? (
                <div className="flex flex-wrap items-center gap-3 rounded-card border border-slate-200 bg-slate-50 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-ink">รูปตรวจรถล่าสุดจากคนขับ</p>
                    <p className="text-[11px] text-ink-faint">
                      บันทึกเมื่อ {new Date(unit.evidence.at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {unit.evidence.vehiclePhotoUrl ? (
                      <a href={unit.evidence.vehiclePhotoUrl} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL preview */}
                        <img src={unit.evidence.vehiclePhotoUrl} alt="รูปรถล่าสุด" className="h-14 w-20 rounded-lg border border-white object-cover shadow-sm" />
                      </a>
                    ) : null}
                    {unit.evidence.platePhotoUrl ? (
                      <a href={unit.evidence.platePhotoUrl} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL preview */}
                        <img src={unit.evidence.platePhotoUrl} alt="รูปป้ายทะเบียนล่าสุด" className="h-14 w-20 rounded-lg border border-white object-cover shadow-sm" />
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {sheet ? <UnitCredentialSheet credentials={sheet} /> : null}

              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {/* One press, both codes. Two buttons meant two half-sheets
                      and an order to remember; the handover is one thing. */}
                  <button
                    type="button"
                    disabled={isPending || !crewed || !missionReady}
                    onClick={() => issueUnitCredentials(unit, needsConfirm)}
                    title={
                      needsConfirm
                        ? "ออก QR คนขับใบใหม่ — ใบเดิมและรหัสเดิมจะใช้ไม่ได้ทันที"
                        : "ออก QR คนขับและ QR ผู้โดยสาร/ผู้ติดตาม พร้อมกันในครั้งเดียว"
                    }
                    className={`flex min-h-9 items-center gap-1.5 rounded-command px-3 text-[12px] font-semibold text-white disabled:opacity-40 ${
                      needsConfirm || hasIssuedSheet ? "bg-amber-600" : "bg-route"
                    }`}
                  >
                    {needsConfirm ? <RefreshCw className="h-3.5 w-3.5" /> : <QrCode className="h-3.5 w-3.5" />}
                    {needsConfirm
                      ? "ยืนยันออก QR ใหม่ทั้ง 2 ใบ"
                      : hasIssuedSheet || hasObserverLink
                        ? "ออก QR ใหม่ทั้ง 2 ใบ"
                        : "ออก QR ทั้ง 2 ใบ"}
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

              {!missionReady ? (
                <p className="mt-2 rounded-card bg-amber-50 px-2.5 py-1.5 text-[12px] font-semibold text-amber-800">
                  ยังออก QR ไม่ได้ — ต้องกำหนดภารกิจหลักให้ Call Sign นี้ในขั้นที่ 1 ก่อน
                </p>
              ) : !crewed ? (
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
