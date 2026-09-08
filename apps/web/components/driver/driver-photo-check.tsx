"use client";

import { useRef, useState } from "react";
import { Camera, Check, Loader2 } from "lucide-react";
import { driverEvidenceUploadAction } from "@/app/actions/driver";

type Kind = "vehicle" | "plate";

const LABELS: Record<Kind, string> = { vehicle: "ถ่ายรูปรถ", plate: "ถ่ายรูปป้ายทะเบียน" };

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

  async function upload(kind: Kind, file: File) {
    setError(null);
    setBusy(kind);
    setPreviews((p) => ({ ...p, [kind]: URL.createObjectURL(file) }));
    try {
      const form = new FormData();
      form.set("token", token);
      form.set("kind", kind);
      form.set("file", file);
      const result = await driverEvidenceUploadAction(form);
      if (result.success && result.data) {
        const next = { ...paths, [kind]: (result.data as { path?: string }).path };
        setPaths(next);
        onChange(next);
      } else {
        setError(result.error || "อัปโหลดรูปไม่สำเร็จ");
        setPreviews((p) => ({ ...p, [kind]: undefined }));
      }
    } catch {
      setError("อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง");
      setPreviews((p) => ({ ...p, [kind]: undefined }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-2">
      <p className="text-[13px] font-semibold text-ink">ถ่ายรูปเป็นหลักฐานก่อนรับงาน (จำเป็น)</p>
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
                  if (file) void upload(kind, file);
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
                <span>{done ? `${LABELS[kind]} ✓` : LABELS[kind]}</span>
              </button>
            </div>
          );
        })}
      </div>
      {error ? <p className="rounded-card bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
