"use client";

import { useRef, useState } from "react";
import { Camera, Check, Loader2 } from "lucide-react";

type Kind = "vehicle" | "plate";

const LABELS: Record<Kind, string> = { vehicle: "ถ่ายรูปรถ", plate: "ถ่ายรูปป้ายทะเบียน" };

// Resize + re-encode to keep the upload small enough for a mobile connection.
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.75);
  });
}

export function DriverPhotoCheck({
  token,
  onChange
}: {
  token: string;
  onChange: (paths: { vehicle?: string; plate?: string }) => void;
}) {
  const [paths, setPaths] = useState<{ vehicle?: string; plate?: string }>({});
  const [previews, setPreviews] = useState<{ vehicle?: string; plate?: string }>({});
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = { vehicle: useRef<HTMLInputElement>(null), plate: useRef<HTMLInputElement>(null) };

  async function handleFile(kind: Kind, file: File) {
    setError(null);
    setBusy(kind);
    setPreviews((p) => ({ ...p, [kind]: URL.createObjectURL(file) }));
    try {
      const blob = await compressImage(file);
      const form = new FormData();
      form.set("token", token);
      form.set("kind", kind);
      form.set("file", new File([blob], `${kind}.jpg`, { type: "image/jpeg" }));
      const res = await fetch("/api/driver/evidence", { method: "POST", body: form });
      const json = (await res.json()) as { success?: boolean; path?: string; error?: string };
      if (res.ok && json.success && json.path) {
        const next = { ...paths, [kind]: json.path };
        setPaths(next);
        onChange(next);
      } else {
        setError(json.error || "อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง");
        setPreviews((p) => ({ ...p, [kind]: undefined }));
      }
    } catch {
      setError("อัปโหลดรูปไม่สำเร็จ ตรวจสอบสัญญาณแล้วลองใหม่");
      setPreviews((p) => ({ ...p, [kind]: undefined }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-2">
      <p className="text-[13px] font-semibold text-ink">ถ่ายรูปเป็นหลักฐานก่อนเริ่มงาน (จำเป็น)</p>
      <div className="grid grid-cols-2 gap-2">
        {(["vehicle", "plate"] as const).map((kind) => {
          const done = Boolean(paths[kind]);
          return (
            <div key={kind}>
              <input
                ref={inputs[kind]}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(kind, file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => inputs[kind].current?.click()}
                className={`flex min-h-24 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-card border text-[12px] font-semibold ${
                  done ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-dashed border-border bg-white text-ink-soft"
                }`}
              >
                {previews[kind] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previews[kind]} alt={LABELS[kind]} className="h-24 w-full object-cover" />
                ) : busy === kind ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : done ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
                <span>{done ? `${LABELS[kind]} ✓` : busy === kind ? "กำลังอัปโหลด…" : LABELS[kind]}</span>
              </button>
            </div>
          );
        })}
      </div>
      {error ? <p className="rounded-card bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
