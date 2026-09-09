"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { establishDriverSessionAction } from "@/app/actions/driver-pin";

type MobileShellWindow = Window & {
  TOMP_MOBILE_SHELL?: {
    namespace: "tomp.driver";
    version: 1;
    postMessage: (message: unknown) => void;
  };
};

// The page's server checks (token, device, PIN cookie) decide whether the driver
// views render. This then exchanges the QR token for the scoped session cookie
// that the /api/driver/* calls carry, done once before any operation call runs.
export function DriverSessionGate({ token, children }: { token: string; children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"establishing" | "ready" | "error">("establishing");
  const [message, setMessage] = useState("");
  const started = useRef(false);

  const establish = useCallback(async () => {
    setState("establishing");
    const result = await establishDriverSessionAction({ token });
    if (result.success) {
      // Best-effort: the mobile shell handshake must never block or fail the
      // driver's task view (it only matters inside the native app).
      await establishMobileSessionIfNeeded().catch(() => undefined);
      setState("ready");
      return;
    }
    // The device or PIN gate moved under us, so re-run the page's server checks.
    if (result.fieldErrors?.needsPin) {
      router.refresh();
      return;
    }
    setMessage(result.error || "เชื่อมต่อเซสชันไม่สำเร็จ");
    setState("error");
  }, [token, router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void establish();
  }, [establish]);

  if (state === "ready") return <>{children}</>;

  return (
    <div className="grid min-h-[60vh] content-center gap-3 text-center">
      {state === "establishing" ? (
        <>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-operation" />
          <p className="text-[13px] text-ink-soft">กำลังเชื่อมต่องาน...</p>
        </>
      ) : (
        <>
          <p className="text-[14px] font-semibold text-ink">{message}</p>
          <button
            type="button"
            onClick={() => void establish()}
            className="mx-auto rounded-command bg-operation px-4 py-2 text-[13px] font-semibold text-white"
          >
            ลองใหม่
          </button>
        </>
      )}
    </div>
  );
}

async function establishMobileSessionIfNeeded() {
  const shell = (window as MobileShellWindow).TOMP_MOBILE_SHELL;
  if (!shell || shell.namespace !== "tomp.driver" || shell.version !== 1) return;

  const response = await fetch("/api/driver/mobile-session/challenge", { method: "POST" });
  const result = (await response.json().catch(() => null)) as { success?: boolean; data?: { code: string; expiresAt: string } } | null;
  if (!result?.success || !result.data) return;

  shell.postMessage({
    namespace: "tomp.driver",
    version: 1,
    type: "mobile-session.challenge",
    payload: result.data
  });
}
