"use client";

import Image from "next/image";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Copy, Download, FileDown, Printer } from "lucide-react";

// What the control room hands over for one crewed unit: the driver's QR with its
// PIN, and the view-only link for whoever is riding or following. Both are
// produced together the moment the unit is crewed, because that is when someone
// is standing there waiting for them.
//
// The PIN is shown once — it is stored only as a hash, so this sheet is the only
// place it will ever appear. That is why saving and printing are on the sheet
// rather than left for the operator to think of.

export interface UnitCredentials {
  callSignId: string;
  callSignLabel: string;
  driverName: string;
  vehicleLabel: string;
  driverUrl: string;
  driverQr: string | null;
  pin: string | null;
  observerUrl: string;
  observerQr: string | null;
}

function saveDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

/**
 * Draw both credentials onto one sheet so the whole handover is a single file.
 *
 * Composed on a canvas rather than screenshotted: the printed sheet has to say
 * who each QR is for, and a rendering of the on-screen layout would carry the
 * buttons and the app chrome with it.
 */
async function composeSheet(credentials: UnitCredentials): Promise<string | null> {
  const W = 1240;
  const H = 1000;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const font = (size: number, weight = "400") => `${weight} ${size}px "Noto Sans Thai", "Sarabun", system-ui, sans-serif`;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#0f172a";
  ctx.font = font(46, "700");
  ctx.fillText(`หน่วยรถ ${credentials.callSignLabel}`, 60, 90);

  ctx.fillStyle = "#475569";
  ctx.font = font(28);
  ctx.fillText(`คนขับ ${credentials.driverName}`, 60, 140);
  ctx.fillText(`รถ ${credentials.vehicleLabel}`, 60, 182);

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, 214);
  ctx.lineTo(W - 60, 214);
  ctx.stroke();

  const columns: Array<{ x: number; heading: string; who: string; how: string; qr: string | null; accent: string }> = [
    {
      x: 60,
      heading: "QR สำหรับคนขับ",
      who: "ให้เฉพาะคนขับของหน่วยนี้",
      how: "สแกน แล้วกรอกรหัส 6 หลักด้านล่าง",
      qr: credentials.driverQr,
      accent: "#0f766e"
    },
    {
      x: W / 2 + 20,
      heading: "QR สำหรับผู้โดยสาร / ผู้ติดตาม",
      who: "ส่งให้ผู้โดยสารหรือผู้ที่ต้องติดตามรถ",
      how: "ดูตำแหน่งรถและปลายทางได้อย่างเดียว ไม่ต้องใช้รหัส",
      qr: credentials.observerQr,
      accent: "#334155"
    }
  ];

  for (const column of columns) {
    ctx.fillStyle = column.accent;
    ctx.font = font(30, "700");
    ctx.fillText(column.heading, column.x, 272);

    ctx.fillStyle = "#0f172a";
    ctx.font = font(23, "600");
    ctx.fillText(column.who, column.x, 312);

    ctx.fillStyle = "#64748b";
    ctx.font = font(21);
    ctx.fillText(column.how, column.x, 348);

    if (column.qr) {
      try {
        const image = await loadImage(column.qr);
        ctx.drawImage(image, column.x, 376, 420, 420);
      } catch {
        // A missing QR must not lose the rest of the sheet.
      }
    }
  }

  if (credentials.pin) {
    ctx.fillStyle = "#fffbeb";
    ctx.fillRect(60, 824, W / 2 - 80, 116);
    ctx.strokeStyle = "#f59e0b";
    ctx.strokeRect(60, 824, W / 2 - 80, 116);

    ctx.fillStyle = "#92400e";
    ctx.font = font(22, "600");
    ctx.fillText("รหัสยืนยันของคนขับ", 84, 862);
    ctx.font = font(52, "700");
    ctx.fillText(credentials.pin, 84, 922);
  }

  ctx.fillStyle = "#94a3b8";
  ctx.font = font(19);
  ctx.fillText("ส่ง QR คนขับกับรหัสยืนยันคนละช่องทาง เพื่อความปลอดภัย", W / 2 + 20, 872);
  ctx.fillText(`ออกเมื่อ ${new Date().toLocaleString("th-TH")}`, W / 2 + 20, 906);

  return canvas.toDataURL("image/png");
}

function CredentialBlock({
  heading, who, how, qr, url, filename, tone, pin, missingNote
}: {
  heading: string;
  who: string;
  how: string;
  qr: string | null;
  url: string;
  filename: string;
  tone: "driver" | "observer";
  /** Shown inside this block, because it only unlocks this block's QR. */
  pin?: string | null;
  /** What to say when there is no QR to draw — absent is not the same as failed. */
  missingNote?: string;
}) {
  return (
    <div className={`grid min-w-0 content-start gap-2 rounded-xl border p-3 ${tone === "driver" ? "border-teal-300 bg-white" : "border-slate-300 bg-slate-50/70"}`}>
      <div className="min-w-0">
        <p className={`text-[13px] font-bold ${tone === "driver" ? "text-teal-800" : "text-slate-700"}`}>{heading}</p>
        <p className="text-[12px] font-semibold text-ink">{who}</p>
        <p className="text-[11px] leading-4 text-ink-soft">{how}</p>
      </div>
      {qr ? (
        <Image src={qr} alt={heading} width={150} height={150} unoptimized className="mx-auto" />
      ) : (
        <div className="grid h-[150px] place-items-center px-3 text-center text-[11px] leading-4 text-ink-faint">
          {missingNote ?? "ออก QR ไม่สำเร็จ"}
        </div>
      )}
      {pin ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-center">
          <p className="text-[10px] font-semibold text-amber-900">รหัสยืนยันของ QR ใบนี้ (แสดงครั้งเดียว)</p>
          <p className="text-xl font-bold leading-tight tracking-[0.25em] text-amber-900">{pin}</p>
          <p className="text-[10px] leading-3 text-amber-800">ส่งคนละช่องทางกับ QR</p>
        </div>
      ) : null}
      <p className="max-h-14 overflow-y-auto break-all rounded-lg bg-white/80 px-2 py-1 text-[10px] leading-4 text-ink-faint ring-1 ring-slate-200">
        {url || "ยังไม่มีลิงก์"}
      </p>
      <div className="flex flex-wrap items-center gap-1.5 print:hidden">
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(url)}
          disabled={!url}
          className="inline-flex h-8 max-w-full shrink-0 items-center justify-center gap-1 rounded-command border border-slate-300 bg-white px-2.5 text-[11px] font-semibold leading-none text-ink-soft disabled:opacity-45"
          title="คัดลอกลิงก์"
        >
          <Copy className="h-3 w-3 shrink-0" /> <span className="truncate">คัดลอกลิงก์</span>
        </button>
        {qr ? (
          <button
            type="button"
            onClick={() => saveDataUrl(qr, filename)}
            className="inline-flex h-8 max-w-full shrink-0 items-center justify-center gap-1 rounded-command border border-slate-300 bg-white px-2.5 text-[11px] font-semibold leading-none text-ink-soft"
            title="ดาวน์โหลดเฉพาะ QR นี้"
          >
            <Download className="h-3 w-3 shrink-0" /> <span className="truncate">เฉพาะ QR นี้</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function UnitCredentialSheet({ credentials }: { credentials: UnitCredentials }) {
  const [busy, setBusy] = useState(false);
  // Whether this operator has actually taken a copy. The driver half cannot be
  // recovered, so "you still have not saved it" is worth saying until they have.
  const [saved, setSaved] = useState(false);
  // Open on arrival, because a freshly issued PIN is shown once and closing it
  // by default would hide the one thing that cannot be recovered. Foldable after
  // that: two QR codes are the tallest thing on the card.
  const [open, setOpen] = useState(true);
  const safeName = credentials.callSignLabel.replace(/[^\w-]+/g, "-");
  // The driver half exists in this tab and nowhere else: the token is stored as
  // a hash and the PIN with it, so a reload does not hide them, it loses them.
  const hasDriverHalf = Boolean(credentials.driverQr || credentials.pin);

  async function saveWholeSheet() {
    setBusy(true);
    try {
      const dataUrl = await composeSheet(credentials);
      if (dataUrl) {
        saveDataUrl(dataUrl, `หน่วยรถ-${safeName}-QR.png`);
        setSaved(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-2xl border-2 border-teal-300 bg-teal-50/40 p-3 print:border-0 print:bg-white" data-credential-sheet>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-teal-700">
            {hasDriverHalf ? "หน่วยรถพร้อมใช้งาน — QR ออกครบทั้ง 2 ใบแล้ว" : "หน่วยรถพร้อมใช้งาน — แสดง QR ผู้โดยสารใบเดิม"}
          </p>
          <p className="text-base font-bold text-ink">{credentials.callSignLabel}</p>
          <p className="text-[12px] text-ink-soft">
            คนขับ {credentials.driverName} · รถ {credentials.vehicleLabel}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-teal-800">
            QR ผู้โดยสารดูซ้ำได้ทุกเมื่อ เพราะเป็นลิงก์อ่านอย่างเดียว — ส่วน QR คนขับกับรหัส PIN เก็บเป็นค่าเข้ารหัส จึงแสดงได้ครั้งเดียวเท่านั้น
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5 print:hidden">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="inline-flex h-9 max-w-full shrink-0 items-center justify-center gap-1.5 rounded-command border border-teal-300 bg-white px-3 text-[12px] font-semibold leading-none text-teal-800"
            title={open ? "ซ่อนแผ่น QR โดยไม่ออก QR ใหม่" : "แสดงแผ่น QR เดิม"}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
            <span className="truncate">{open ? "ซ่อนแผ่น QR" : "แสดงแผ่น QR เดิม"}</span>
          </button>
          <button
            type="button"
            onClick={saveWholeSheet}
            disabled={busy}
            className="inline-flex h-9 max-w-full shrink-0 items-center justify-center gap-1.5 rounded-command bg-operation px-3 text-[12px] font-semibold leading-none text-white disabled:opacity-50"
            title="ดาวน์โหลด QR คนขับและ QR ผู้ติดตามรวมเป็นภาพเดียว"
          >
            <FileDown className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{busy ? "กำลังสร้าง..." : "ดาวน์โหลดรวมเป็นภาพ"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSaved(true);
              window.print();
            }}
            className="inline-flex h-9 max-w-full shrink-0 items-center justify-center gap-1.5 rounded-command bg-ink px-3 text-[12px] font-semibold leading-none text-white"
            title="พิมพ์หรือบันทึกเป็น PDF"
          >
            <Printer className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">พิมพ์ / บันทึก PDF</span>
          </button>
        </div>
      </div>


      {hasDriverHalf ? (
        <div
          className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${
            saved ? "border-emerald-300 bg-emerald-50" : "border-amber-400 bg-amber-50"
          }`}
        >
          {saved ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          )}
          <p className={`text-[11px] font-semibold leading-4 ${saved ? "text-emerald-900" : "text-amber-900"}`}>
            {saved
              ? "บันทึกแล้ว — ตรวจดูว่าไฟล์หรือใบที่พิมพ์อ่านได้ครบก่อนปิดหน้านี้"
              : "ต้องดาวน์โหลดหรือพิมพ์เดี๋ยวนี้ ก่อนปิดหรือรีเฟรชหน้านี้ — QR คนขับและรหัส PIN จะไม่แสดงอีก ถ้าพลาดต้องออกใบใหม่ ซึ่งใบที่แจกไปแล้วจะใช้ไม่ได้ทันที"}
          </p>
        </div>
      ) : null}

      {open ? (
      <div className="grid min-w-0 items-start gap-3 md:grid-cols-2">
        <CredentialBlock
          tone="driver"
          heading="① QR คนขับ"
          who="สำหรับคนขับของหน่วยนี้เท่านั้น"
          how="สแกนแล้วกรอกรหัส 6 หลักในกล่องนี้ เพื่อเปิดงานและส่งตำแหน่ง GPS"
          qr={credentials.driverQr}
          url={credentials.driverUrl}
          filename={`QR-คนขับ-${safeName}.png`}
          pin={credentials.pin}
          missingNote="QR คนขับแสดงได้ครั้งเดียวตอนออกใบ และไม่ได้เก็บไว้ในระบบ — กด “ออก QR ใหม่” ที่การ์ดหน่วยรถเพื่อออกใบใหม่ (ใบเดิมจะใช้ไม่ได้ทันที)"
        />
        <CredentialBlock
          tone="observer"
          heading="② QR ผู้โดยสาร / ผู้ติดตาม"
          who="สำหรับผู้โดยสาร หรือผู้ที่ต้องติดตามรถคันนี้"
          how="ดูตำแหน่งรถและปลายทางได้อย่างเดียว แก้ไขงานไม่ได้ และไม่ต้องใช้รหัส"
          qr={credentials.observerQr}
          url={credentials.observerUrl}
          filename={`QR-ผู้ติดตาม-${safeName}.png`}
        />
      </div>
      ) : null}
    </div>
  );
}
