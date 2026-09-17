"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, Send, X } from "lucide-react";
import type { DriverNotification } from "@tomp/types/domain";
import { buildBridgeMessage, getMobileShell, NATIVE_STATUS_EVENT, parseNativeStatusDetail } from "@tomp/driver-core";
import type { DriverIssueMessage } from "@/lib/data/driver-operations";
import type { DriverMessageAttachment } from "@/lib/data/driver-message-attachments";
import { formatRelativeTh } from "@/lib/format/relative-time-th";

export interface ChatBubble {
  id: string;
  from: "driver" | "centre";
  text: string;
  at: string;
  tone?: "info" | "issue" | "critical";
  deliveryStatus?: "sent" | "pending";
  attachment?: DriverMessageAttachment | null;
}

const QUICK_MESSAGES = [
  "ถึงจุดรับแล้ว",
  "กำลังเดินทางไปจุดส่ง",
  "การจราจรหนาแน่น คาดว่าจะล่าช้าประมาณ 15 นาที",
  "ไม่สามารถติดต่อผู้โดยสารได้",
  "ถึงจุดส่งแล้ว"
];

export function buildBubbles(messages: DriverIssueMessage[], notifications: DriverNotification[]): ChatBubble[] {
  const fromDriver: ChatBubble[] = messages.map((m) => ({
    id: `m-${m.id}`,
    from: "driver",
    text: m.text || (m.issueType === "message" ? "(ไม่มีข้อความ)" : m.issueType),
    at: m.at,
    tone: m.issueType === "message" ? "info" : m.severity === "critical" || m.severity === "urgent" ? "critical" : "issue",
    deliveryStatus: m.deliveryStatus,
    attachment: m.attachment
  }));
  const fromCentre: ChatBubble[] = notifications.map((n) => ({
    id: `n-${n.id}`,
    from: "centre",
    text: n.body || n.title,
    at: n.createdAt,
    tone: n.priority === "critical" ? "critical" : "info"
  }));
  return [...fromDriver, ...fromCentre].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

type PendingPhoto = DriverMessageAttachment & { previewUrl?: string | null };
type CaptureLocation = { latitude: number; longitude: number; accuracy: number | null; recordedAt?: string | null };

function locationFromNativeStatusDetail(detail: unknown): CaptureLocation | null {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const value = detail as Record<string, unknown>;
  if (typeof value.latitude !== "number" || typeof value.longitude !== "number") return null;
  return {
    latitude: value.latitude,
    longitude: value.longitude,
    accuracy: typeof value.accuracy === "number" ? value.accuracy : null,
    recordedAt: typeof value.recordedAt === "string" ? value.recordedAt : null
  };
}

function isRecentLocation(location: CaptureLocation | null, now = Date.now()) {
  if (!location) return false;
  const recordedAt = location.recordedAt ? new Date(location.recordedAt).getTime() : now;
  return Number.isFinite(recordedAt) && now - recordedAt <= 5 * 60 * 1000;
}

function getCaptureLocation(): Promise<CaptureLocation | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
          recordedAt: new Date(position.timestamp).toISOString()
        }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
    );
  });
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality));
}

async function stampPhoto(file: File, capturedAt: string, location: PendingPhoto): Promise<{ file: File; stampApplied: boolean }> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { file, stampApplied: false };

  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return { file, stampApplied: false };
  }

  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const stampHeight = Math.max(92, Math.round(canvas.height * 0.12));
  const top = canvas.height - stampHeight;
  const gradient = ctx.createLinearGradient(0, top, 0, canvas.height);
  gradient.addColorStop(0, "rgba(7, 24, 39, 0.1)");
  gradient.addColorStop(1, "rgba(7, 24, 39, 0.82)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, top, canvas.width, stampHeight);

  const pad = Math.max(18, Math.round(canvas.width * 0.025));
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.max(22, Math.round(canvas.width * 0.026))}px sans-serif`;
  ctx.fillText(`TOMP · ${new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(capturedAt))}`, pad, top + pad + 18);
  ctx.font = `600 ${Math.max(18, Math.round(canvas.width * 0.02))}px sans-serif`;
  const coordinate =
    location.hasLocation && location.latitude != null && location.longitude != null
      ? `GPS ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}${location.accuracy ? ` · ±${Math.round(location.accuracy)} ม.` : ""}`
      : "GPS ไม่มีพิกัด ณ เวลาถ่ายภาพ";
  ctx.fillText(coordinate, pad, top + pad + 52);

  const blob = await canvasBlob(canvas, 0.78);
  return {
    file: new File([blob ?? file], "driver-message-photo.jpg", { type: "image/jpeg" }),
    stampApplied: Boolean(blob)
  };
}

export function DriverChatThread({
  messages,
  notifications,
  onSend,
  sending
}: {
  messages: DriverIssueMessage[];
  notifications: DriverNotification[];
  onSend: (text: string, attachment?: DriverMessageAttachment | null) => void;
  sending: boolean;
}) {
  const [text, setText] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const [photo, setPhoto] = useState<PendingPhoto | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nativeLocationRef = useRef<CaptureLocation | null>(null);
  const bubbles = useMemo(() => buildBubbles(messages, notifications), [messages, notifications]);

  useEffect(() => {
    const handleNativeStatus = (event: Event) => {
      const payload = parseNativeStatusDetail((event as CustomEvent).detail);
      if (payload?.status !== "gps_sharing") return;
      const location = locationFromNativeStatusDetail(payload.detail);
      if (location) nativeLocationRef.current = location;
    };
    window.addEventListener(NATIVE_STATUS_EVENT, handleNativeStatus);
    return () => window.removeEventListener(NATIVE_STATUS_EVENT, handleNativeStatus);
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [bubbles.length]);

  // grow the composer with its content, up to ~6 lines (chat-app style)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  function submit() {
    const value = text.trim();
    if (!value && !photo) return;
    onSend(value || "ส่งรูปจากคนขับ", photo);
    setText("");
    setPhoto(null);
  }

  function requestNativeLocationSnapshot(timeoutMs = 1200): Promise<CaptureLocation | null> {
    if (isRecentLocation(nativeLocationRef.current)) return Promise.resolve(nativeLocationRef.current);

    const shell = getMobileShell(window);
    if (!shell?.canBackgroundLocation) return Promise.resolve(null);

    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        window.removeEventListener(NATIVE_STATUS_EVENT, handleNativeStatus);
        resolve(isRecentLocation(nativeLocationRef.current) ? nativeLocationRef.current : null);
      }, timeoutMs);

      const handleNativeStatus = (event: Event) => {
        const payload = parseNativeStatusDetail((event as CustomEvent).detail);
        if (payload?.status !== "gps_sharing") return;
        const location = locationFromNativeStatusDetail(payload.detail);
        if (!location) return;
        nativeLocationRef.current = location;
        window.clearTimeout(timer);
        window.removeEventListener(NATIVE_STATUS_EVENT, handleNativeStatus);
        resolve(location);
      };

      window.addEventListener(NATIVE_STATUS_EVENT, handleNativeStatus);
      shell.postMessage(buildBridgeMessage("gps.status.request", { reason: "photo_attachment" }));
    });
  }

  async function handlePhoto(file: File) {
    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      const capturedAt = new Date().toISOString();
      const nativeSnapshot = requestNativeLocationSnapshot();
      const location = (await getCaptureLocation()) ?? (await nativeSnapshot);
      const base: PendingPhoto = {
        type: "photo",
        storagePath: "",
        capturedAt,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        accuracy: location?.accuracy ?? null,
        hasLocation: Boolean(location),
        stampApplied: true
      };
      const stamped = await stampPhoto(file, capturedAt, base);
      const previewUrl = URL.createObjectURL(stamped.file);
      const form = new FormData();
      form.set("file", stamped.file);
      form.set("capturedAt", capturedAt);
      const response = await fetch("/api/driver/message-photo", { method: "POST", body: form });
      const json = (await response.json().catch(() => null)) as { success?: boolean; data?: { storagePath?: string }; error?: string } | null;
      if (!response.ok || !json?.success || !json.data?.storagePath) {
        URL.revokeObjectURL(previewUrl);
        setPhotoError(json?.error || "อัปโหลดรูปไม่สำเร็จ");
        return;
      }
      setPhoto({ ...base, storagePath: json.data.storagePath, previewUrl, signedUrl: previewUrl, stampApplied: stamped.stampApplied });
    } catch {
      setPhotoError("อัปโหลดรูปไม่สำเร็จ กรุณาตรวจสอบสัญญาณแล้วลองใหม่");
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <section id="driver-chat" className="grid gap-2.5 rounded-[1.25rem] border border-border/70 bg-white/95 p-3 shadow-[0_10px_28px_rgba(16,32,51,0.07)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold text-ink">ข้อความจากศูนย์ควบคุม</p>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">พร้อมส่งข้อความ</span>
      </div>

      <div className="sticky top-0 z-10 grid gap-2 rounded-[1rem] border border-border/80 bg-white p-2 shadow-sm">
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handlePhoto(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={sending || uploadingPhoto}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.95rem] border border-border bg-white text-ink-soft shadow-sm transition active:scale-[0.98] disabled:opacity-50"
            aria-label="แนบรูปถ่าย"
          >
            {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
          <textarea
            ref={inputRef}
            className="field-input min-h-11 flex-1 resize-none overflow-y-auto rounded-[0.9rem] border-border/80 bg-canvas/70 text-[13px]"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="พิมพ์ข้อความถึงศูนย์ควบคุม"
          />
          <button
            type="button"
            onClick={submit}
            disabled={sending || uploadingPhoto || (!text.trim() && !photo)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.95rem] bg-operation text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
            aria-label="ส่งข้อความ"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {photo ? (
          <div className="flex items-center gap-2 rounded-xl bg-canvas/80 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview or signed storage URL */}
            <img src={photo.signedUrl || photo.previewUrl || ""} alt="รูปที่จะส่งให้ศูนย์ควบคุม" className="h-14 w-20 rounded-lg object-cover" />
            <p className="min-w-0 flex-1 text-[11px] leading-4 text-ink-soft">
              รูปนี้มีตราประทับเวลา{photo.hasLocation ? "และพิกัด GPS" : " แต่ไม่มีพิกัด GPS ณ เวลาถ่ายภาพ"}
            </p>
            <button type="button" onClick={() => setPhoto(null)} className="grid h-8 w-8 place-items-center rounded-lg bg-white text-ink-faint" aria-label="ลบรูป">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        {photoError ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">{photoError}</p> : null}
      </div>

      <div className="grid max-h-[52dvh] gap-1.5 overflow-y-auto rounded-[1rem] bg-canvas/80 p-2">
        {bubbles.length ? (
          bubbles.map((b) => (
            <div key={b.id} className={`flex ${b.from === "driver" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-5 shadow-sm ${
                  b.from === "driver"
                    ? "bg-operation text-white"
                    : b.tone === "critical"
                      ? "border border-rose-200 bg-rose-50 text-rose-900"
                      : "border border-border bg-white text-ink"
                }`}
              >
                {b.tone === "issue" && b.from === "driver" ? <span className="font-semibold">[แจ้งปัญหา] </span> : null}
                {b.text}
                {b.attachment?.signedUrl ? (
                  <a href={b.attachment.signedUrl} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl border border-white/40 bg-black/5">
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL preview */}
                    <img src={b.attachment.signedUrl} alt="รูปจากคนขับ" className="max-h-56 w-full object-cover" />
                  </a>
                ) : null}
                {b.attachment ? (
                  <span className={`mt-1 block text-[10px] ${b.from === "driver" ? "text-white/70" : "text-ink-faint"}`}>
                    รูปแนบ: {b.attachment.hasLocation ? "มีเวลาและพิกัด GPS" : "มีเวลา แต่ไม่มีพิกัด GPS"}
                  </span>
                ) : null}
                <span className={`mt-0.5 block text-[10px] ${b.from === "driver" ? "text-white/70" : "text-ink-faint"}`}>
                  {b.deliveryStatus === "pending" ? "กำลังส่ง · " : null}
                  {now ? formatRelativeTh(b.at, now) : "กำลังเตรียมเวลา"}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="px-2 py-5 text-center text-[12px] text-ink-faint">ยังไม่มีข้อความ สามารถส่งข้อความถึงศูนย์ควบคุมได้จากช่องด้านบน</p>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_MESSAGES.map((phrase) => (
          <button
            key={phrase}
            type="button"
            onClick={() => setText(phrase)}
            className="rounded-full border border-border/80 bg-white px-2.5 py-1 text-[12px] font-semibold text-ink-soft shadow-sm transition active:scale-[0.98]"
          >
            {phrase}
          </button>
        ))}
      </div>
    </section>
  );
}
