"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function VehicleProfileQr({ vehicleId, plateNumber }: { vehicleId: string; plateNumber: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function renderQr() {
      const url = `${window.location.origin}/resources/vehicles/${vehicleId}`;
      setProfileUrl(url);
      const QRCode = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(url, { margin: 2, width: 128, errorCorrectionLevel: "M" });
      if (!cancelled) setQrDataUrl(dataUrl);
    }
    void renderQr();
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  return (
    <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-500">QR ประจำรถ</p>
      <div className="grid h-32 w-32 place-items-center rounded-xl border border-slate-200 bg-slate-50">
        {qrDataUrl ? <Image alt={`QR ประจำรถ ${plateNumber}`} height={128} src={qrDataUrl} unoptimized width={128} /> : <span className="text-xs text-slate-500">กำลังสร้าง QR</span>}
      </div>
      {profileUrl ? <p className="max-w-32 break-all text-[10px] leading-4 text-slate-500">{profileUrl}</p> : null}
    </div>
  );
}
