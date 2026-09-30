"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-reads the driver page every few minutes while it is on screen, and when
 * the app comes back to the foreground. The waiting page has nothing to press
 * until work arrives or its day begins; this is how it notices either.
 */
export function DriverPageRefresher({ everyMs = 120_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, everyMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [everyMs, router]);
  return null;
}
