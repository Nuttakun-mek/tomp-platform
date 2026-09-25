"use client";

import { useEffect, useState } from "react";
import { ScanLine } from "lucide-react";
import { buildBridgeMessage, getMobileShell, MOBILE_SHELL_READY_EVENT, type MobileShellHandle } from "@tomp/driver-core";

// Shown on "ไม่พบงานสำหรับลิงก์นี้" inside the driver app only. The app reopens
// the last saved job on every launch, and on iOS that token outlives updates and
// reinstalls, so a job deleted on the server left the driver on this page with no
// way back except a button hidden on the GPS tab. In a plain browser there is
// nothing to leave, so nothing renders.
export function DriverLeaveJobButton() {
  const [shell, setShell] = useState<MobileShellHandle | null>(null);

  useEffect(() => {
    const detect = () => setShell(getMobileShell(window));
    detect();
    window.addEventListener(MOBILE_SHELL_READY_EVENT, detect);
    return () => window.removeEventListener(MOBILE_SHELL_READY_EVENT, detect);
  }, []);

  if (!shell) return null;

  return (
    <button
      type="button"
      onClick={() => shell.postMessage(buildBridgeMessage("job.leave", { reason: "link_not_found" }))}
      className="mx-auto mt-4 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-operation px-6 text-sm font-semibold text-white shadow-sm"
    >
      <ScanLine className="h-5 w-5" />
      สแกน QR ใหม่
    </button>
  );
}
