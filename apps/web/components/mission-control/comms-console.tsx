"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ClipboardEvent } from "react";
import { ArrowDownLeft, ArrowUpRight, Camera, ImagePlus, Loader2, MessageSquare, Send, X } from "lucide-react";
import type { Assignment, CallSign } from "@tomp/types/domain";
import { sendDriverNotificationAction } from "@/app/actions/driver-notifications";
import type { DriverInboundMessage, DriverOutboundMessage } from "@/lib/data/driver-comms";
import type { DriverMessageAttachment } from "@/lib/data/driver-message-attachments";
import { formatRelativeTh } from "@/lib/format/relative-time-th";
import { accentFor } from "@/lib/ui/unit-accent";
import { useMissionControlFeed } from "./mission-control-feed";

interface CommsConsoleProps {
  projectId: string;
  assignments: Assignment[];
  callSigns: CallSign[];
}

const QUICK_PHRASES = [
  "ยืนยันด้วยว่าถึงจุดรับแล้วหรือยัง",
  "อัปเดตตำแหน่งปัจจุบันด้วย",
  "มีการเปลี่ยนจุดส่ง โปรดโทรกลับศูนย์",
  "ให้รอลูกค้าที่จุดเดิมก่อน",
  "รับทราบ ขอบคุณ"
];

type FeedItem =
  | ({ direction: "in" } & DriverInboundMessage)
  | ({ direction: "out" } & DriverOutboundMessage);

type PendingPhoto = DriverMessageAttachment & { previewUrl?: string | null; fileName?: string | null };

export function CommsConsole({ projectId, assignments, callSigns }: CommsConsoleProps) {
  const { comms, now } = useMissionControlFeed();
  const inbound = comms.inbound;
  // Optimistic echoes of messages we just sent, dropped once the feed catches up.
  const [optimisticOutbound, setOptimisticOutbound] = useState<DriverOutboundMessage[]>([]);
  const outbound = useMemo(() => {
    const seen = new Set(comms.outbound.map((message) => `${message.assignmentId}::${message.body}`));
    return [...optimisticOutbound.filter((message) => !seen.has(`${message.assignmentId}::${message.body}`)), ...comms.outbound];
  }, [comms.outbound, optimisticOutbound]);
  const [filter, setFilter] = useState<string>("all");
  const [target, setTarget] = useState<string>(assignments[0]?.id ?? "");

  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<PendingPhoto | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [banner, setBanner] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [feedLimit, setFeedLimit] = useState(60);
  const fileRef = useRef<HTMLInputElement>(null);

  const callSignById = useMemo(() => new Map(callSigns.map((cs) => [cs.id, cs.callSign])), [callSigns]);

  // The message reaches a driver, and a driver is one unit however many jobs
  // they hold. Listing one option per job put the same call sign in the list
  // three times over, identical and unchoosable, so the recipients are units and
  // each carries the job a message should land on: the one running, or the next
  // one due.
  const recipients = useMemo(() => {
    const byUnit = new Map<string, { label: string; assignmentId: string; jobs: number }>();
    const live = assignments.filter((assignment) => !["cancelled", "archived"].includes(assignment.status));

    for (const assignment of live) {
      const key = assignment.callSignId || `job:${assignment.id}`;
      const label = callSignById.get(assignment.callSignId) ?? `งาน ${assignment.id.slice(0, 8)}`;
      const held = byUnit.get(key);
      if (!held) {
        byUnit.set(key, { label, assignmentId: assignment.id, jobs: 1 });
        continue;
      }
      held.jobs += 1;
      const heldRow = live.find((item) => item.id === held.assignmentId);
      const preferable =
        assignment.status === "active" ||
        (heldRow?.status !== "active" &&
          (assignment.startTime ?? "") !== "" &&
          (heldRow?.startTime ?? "") !== "" &&
          String(assignment.startTime) < String(heldRow?.startTime));
      if (preferable) held.assignmentId = assignment.id;
    }

    return [...byUnit.values()].sort((a, b) => a.label.localeCompare(b.label, "th"));
  }, [assignments, callSignById]);
  const assignmentInfo = useMemo(() => {
    const map = new Map<string, { label: string; driverId: string | null; accent: ReturnType<typeof accentFor> }>();
    for (const assignment of assignments) {
      const label = callSignById.get(assignment.callSignId) ?? `งาน ${assignment.id.slice(0, 8)}`;
      map.set(assignment.id, {
        label,
        driverId: assignment.driverId ?? null,
        accent: accentFor(label)
      });
    }
    return map;
  }, [assignments, callSignById]);

  const { feed, olderCount } = useMemo(() => {
    const items: FeedItem[] = [
      ...inbound.map((item) => ({ direction: "in" as const, ...item })),
      ...outbound.map((item) => ({ direction: "out" as const, ...item }))
    ];
    // oldest first, newest at the bottom — like a normal chat app
    items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    const scoped = filter === "all" ? items : items.filter((item) => item.assignmentId === filter);
    return { feed: scoped.slice(-feedLimit), olderCount: Math.max(0, scoped.length - feedLimit) };
  }, [inbound, outbound, filter, feedLimit]);

  const feedEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [feed.length, filter]);

  const usedAssignmentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of [...inbound, ...outbound]) ids.add(item.assignmentId);
    return ids;
  }, [inbound, outbound]);

  function clearPhoto() {
    setPhoto((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    setPhotoError(null);
  }

  async function handlePhoto(file: File) {
    if (!target) {
      setPhotoError("กรุณาเลือก Call Sign ก่อนแนบรูป");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setPhotoError("รองรับเฉพาะไฟล์รูปภาพ");
      return;
    }

    setPhotoError(null);
    setUploadingPhoto(true);
    const capturedAt = new Date().toISOString();
    const previewUrl = URL.createObjectURL(file);
    try {
      const form = new FormData();
      form.set("projectId", projectId);
      form.set("assignmentId", target);
      form.set("capturedAt", capturedAt);
      form.set("file", file);
      const response = await fetch("/api/mission-control/message-photo", { method: "POST", body: form });
      const json = (await response.json().catch(() => null)) as { success?: boolean; data?: { storagePath?: string; capturedAt?: string | null }; error?: string } | null;
      if (!response.ok || !json?.success || !json.data?.storagePath) {
        URL.revokeObjectURL(previewUrl);
        setPhotoError(json?.error || "อัปโหลดรูปไม่สำเร็จ");
        return;
      }
      clearPhoto();
      setPhoto({
        type: "photo",
        storagePath: json.data.storagePath,
        capturedAt: json.data.capturedAt ?? capturedAt,
        hasLocation: false,
        stampApplied: false,
        signedUrl: previewUrl,
        previewUrl,
        fileName: file.name || "รูปจากศูนย์ควบคุม"
      });
    } catch {
      URL.revokeObjectURL(previewUrl);
      setPhotoError("อัปโหลดรูปไม่สำเร็จ กรุณาตรวจสอบไฟล์และลองใหม่");
    } finally {
      setUploadingPhoto(false);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"));
    if (!image) return;
    event.preventDefault();
    void handlePhoto(image);
  }

  function send() {
    const body = text.trim();
    if ((!body && !photo) || !target) return;
    const info = assignmentInfo.get(target);
    const attachment = photo;
    setBanner(null);
    startTransition(async () => {
      const messageBody = body || "ส่งรูปจากศูนย์ควบคุม";
      const result = await sendDriverNotificationAction({
        projectId,
        assignmentId: target,
        driverId: info?.driverId ?? null,
        title: "ข้อความจากศูนย์ควบคุม",
        body: messageBody,
        priority: "normal",
        actionLabel: "รับทราบ",
        attachment
      });
      if (result.success) {
        setText("");
        setPhoto(null);
        setPhotoError(null);
        setBanner({ tone: "ok", text: "ส่งข้อความถึงคนขับแล้ว" });
        setOptimisticOutbound((current) => [
          {
            id: `local-${Date.now()}`,
            assignmentId: target,
            driverId: info?.driverId ?? null,
            title: "ข้อความจากศูนย์ควบคุม",
            body: messageBody,
            priority: "normal",
            status: "unread",
            at: new Date().toISOString(),
            attachment
          },
          ...current
        ]);
      } else {
        setBanner({ tone: "error", text: result.error || "ส่งข้อความไม่สำเร็จ" });
      }
    });
  }

  return (
    <section className="enterprise-panel overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-semibold tracking-[0.16em] text-operation">การสื่อสารกับคนขับ</p>
        <h2 className="mt-1 text-lg font-semibold text-ink">ข้อความสองทาง ศูนย์ ↔ คนขับ</h2>
        <p className="mt-1 text-xs text-slate-500">ข้อความจากคนขับผ่าน QR · ศูนย์ตอบกลับได้ที่นี่ · รีเฟรชอัตโนมัติทุก 10 วินาที</p>
      </div>

      <div className="grid gap-4 p-4 sm:p-4 lg:grid-cols-[0.9fr_1.1fr]">
        {/* composer */}
        <div className="grid content-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <label className="text-xs font-semibold text-slate-600">ส่งถึง Call Sign</label>
          <select
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            value={target}
            onChange={(event) => {
              setTarget(event.target.value);
              clearPhoto();
            }}
          >
            {recipients.length ? (
              recipients.map((recipient) => (
                <option key={recipient.assignmentId} value={recipient.assignmentId}>
                  {recipient.label}
                  {recipient.jobs > 1 ? ` (${recipient.jobs} งาน)` : ""}
                </option>
              ))
            ) : (
              <option value="">ยังไม่มีงานในโครงการนี้</option>
            )}
          </select>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PHRASES.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => setText(phrase)}
                className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-operation hover:text-operation"
              >
                {phrase}
              </button>
            ))}
          </div>
          <textarea
            className="min-h-20 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onPaste={handlePaste}
            placeholder="พิมพ์ข้อความถึงคนขับ…"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handlePhoto(file);
              event.target.value = "";
            }}
          />
          {photo ? (
            <div className="flex items-center gap-2 rounded-xl border border-operation/20 bg-operation-soft p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview before sending to driver */}
              <img src={photo.previewUrl || photo.signedUrl || ""} alt="รูปที่จะส่งให้คนขับ" className="h-14 w-20 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-ink">{photo.fileName || "รูปจากศูนย์ควบคุม"}</p>
                <p className="text-[11px] text-ink-faint">แนบรูปนี้ไปพร้อมข้อความถึงคนขับ</p>
              </div>
              <button type="button" onClick={clearPhoto} className="grid h-8 w-8 place-items-center rounded-lg bg-white text-ink-faint" aria-label="ลบรูปแนบ">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          {photoError ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{photoError}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isPending || uploadingPhoto || !target}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-ink-soft hover:border-operation hover:text-operation disabled:opacity-50"
            >
              {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              เพิ่มรูป
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isPending || uploadingPhoto || !target}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-ink-soft hover:border-operation hover:text-operation disabled:opacity-50"
              title="ถ้าอุปกรณ์รองรับ สามารถเปิดกล้องจากเบราว์เซอร์ได้"
            >
              <Camera className="h-4 w-4" />
              ถ่ายรูป
            </button>
          </div>
          <button
            type="button"
            onClick={send}
            disabled={isPending || uploadingPhoto || (!text.trim() && !photo) || !target}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-operation px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {isPending ? "กำลังส่ง…" : "ส่งข้อความ"}
          </button>
          {banner ? (
            <p className={`rounded-xl px-3 py-2 text-xs font-semibold ${banner.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{banner.text}</p>
          ) : null}
        </div>

        {/* feed */}
        <div className="grid content-start gap-2">
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              ทั้งหมด
            </FilterChip>
            {assignments
              .filter((assignment) => usedAssignmentIds.has(assignment.id))
              .map((assignment) => (
                <FilterChip key={assignment.id} active={filter === assignment.id} onClick={() => setFilter(assignment.id)}>
                  {callSignById.get(assignment.callSignId) ?? `งาน ${assignment.id.slice(0, 8)}`}
                </FilterChip>
              ))}
          </div>

          {feed.length ? (
            <div className="grid max-h-[420px] gap-1.5 overflow-y-auto rounded-[1rem] bg-canvas/80 p-2">
              {olderCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setFeedLimit((current) => current + 60)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-operation hover:text-operation"
                >
                  โหลดข้อความเก่ากว่านี้ (อีก {olderCount})
                </button>
              ) : null}
              {feed.map((item) => {
                const info = assignmentInfo.get(item.assignmentId);
                const label = info?.label ?? `งาน ${item.assignmentId.slice(0, 8)}`;
                const accent = info?.accent ?? accentFor(label);
                if (item.direction === "in") {
                  return (
                    <article key={`in-${item.id}`} className={`ml-auto max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-5 text-white shadow-sm ${item.severity === "critical" || item.severity === "urgent" ? "bg-rose-600" : "bg-operation"}`}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-white/80">
                        <span className="inline-flex items-center gap-1">
                          <ArrowDownLeft className="h-3.5 w-3.5" />
                          <span className="rounded-full bg-white/15 px-2 py-0.5 text-white">{label}</span>
                          <span className="text-white/80">คนขับ</span>
                        </span>
                        <span className="opacity-70">{formatRelativeTh(item.at, now)}</span>
                      </div>
                      <p className="mt-1">
                        {item.kind === "issue" ? <span className="font-semibold">[แจ้งปัญหา] </span> : null}
                        {item.message || "(ไม่มีข้อความ)"}
                      </p>
                      {item.attachment?.signedUrl ? (
                        <a href={item.attachment.signedUrl} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl border border-white/40 bg-black/5">
                          {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL preview */}
                          <img src={item.attachment.signedUrl} alt="รูปจากคนขับ" className="max-h-52 w-full object-cover" />
                        </a>
                      ) : null}
                      {item.attachment ? (
                        <p className="mt-1 text-[10px] text-white/70">
                          รูปแนบมีตราประทับเวลา{item.attachment.hasLocation ? "และพิกัด GPS" : " แต่ไม่มีพิกัด GPS ณ เวลาถ่ายภาพ"}
                        </p>
                      ) : null}
                    </article>
                  );
                }
                return (
                  <article key={`out-${item.id}`} className="mr-auto max-w-[82%] rounded-2xl border border-border bg-white px-3 py-2 text-[13px] leading-5 text-ink shadow-sm">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-ink-faint">
                      <span className="inline-flex items-center gap-1">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        <span className={`rounded-full px-2 py-0.5 ${accent.soft}`}>{label}</span>
                        <span>ศูนย์ควบคุม</span>
                      </span>
                      <span className="opacity-70">{formatRelativeTh(item.at, now)}</span>
                    </div>
                    <p className="mt-1">{item.body}</p>
                    {item.attachment?.signedUrl ? (
                      <a href={item.attachment.signedUrl} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl border border-border bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL or local optimistic preview */}
                        <img src={item.attachment.signedUrl} alt="รูปจากศูนย์ควบคุม" className="max-h-52 w-full object-cover" />
                      </a>
                    ) : null}
                    <p className="mt-1 text-[10px] text-ink-faint">{item.status === "unread" ? "ยังไม่อ่าน" : item.status === "read" ? "อ่านแล้ว" : "รับทราบแล้ว"}</p>
                  </article>
                );
              })}
              <div ref={feedEndRef} />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-600">
              <MessageSquare className="mx-auto h-5 w-5 text-slate-400" />
              <p className="mt-2">ยังไม่มีข้อความ เมื่อคนขับส่งข้อความผ่าน QR หรือศูนย์ส่งข้อความออกไป จะแสดงที่นี่</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${active ? "bg-operation text-white" : "border border-slate-300 bg-white text-slate-600"}`}
    >
      {children}
    </button>
  );
}
