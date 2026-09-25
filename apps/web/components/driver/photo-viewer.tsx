"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

// Full-screen photo inside the page. The chat used to link to the signed
// storage URL instead, and inside the driver app the WebView only navigates to
// TOMP's own pages and a short allow-list, so a tap on a photo did nothing.
export function PhotoViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-3" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" onClick={(event) => event.stopPropagation()} />
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="ปิดรูป"
        className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
