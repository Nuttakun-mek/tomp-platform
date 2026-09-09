"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { establishDriverSessionAction } from "@/app/actions/driver-pin";

// The page's server checks (token, device, PIN cookie) decide whether the driver
// views render. This then exchanges the QR token for the scoped session cookie
// that the /api/driver/* calls carry — done once, before any of them fire.
export function DriverSessionGate({ token, children }: { token: string; children: ReactNode }) {
  const [state, setState] = useState<"establishing" | "ready" | "error">("establishing");
  const [message, setMessage] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const result = await establishDriverSessionAction({ token });
      if (result.success) {
        setState("ready");
        return;
      }
      // The device or PIN gate moved under us — a reload re-runs the page checks.
      if (result.fieldErrors?.needsPin) {
        window.location.reload();
        return;
      }
      setMessage(result.error || "เชื่อมต่อเซสชันไม่สำเร็จ");
      setState("error");
    })();
  }, [token]);

  if (state === "ready") return <>{children}</>;

  return (
    <div className="grid min-h-[60vh] content-center gap-3 text-center">
      {state === "establishing" ? (
        <>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-operation" />
          <p className="text-[13px] text-ink-soft">กำลังเชื่อมต่องาน…</p>
        </>
      ) : (
        <>
          <p className="text-[14px] font-semibold text-ink">{message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mx-auto rounded-command bg-operation px-4 py-2 text-[13px] font-semibold text-white"
          >
            ลองใหม่
          </button>
        </>
      )}
    </div>
  );
}
