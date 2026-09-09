"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { DriverLocation } from "@tomp/types/domain";
import type { AssignmentStatusUpdate } from "@/lib/data/assignment-status";
import type { DriverInboundMessage, DriverOutboundMessage } from "@/lib/data/driver-comms";
import type { VehicleEvidence } from "@/lib/data/vehicle-evidence";
import { subscribeToDriverLocations, unsubscribeMissionControl } from "@/lib/realtime/mission-control";

// One live feed for the whole control room. The map, the fleet board and the
// comms console each used to poll on their own timer, so /locations and /comms
// were both fetched twice every cycle and three independent `now` clocks drifted
// apart. This provider polls each endpoint once every 10s, holds a single clock,
// keeps one realtime subscription, and pauses while the tab is hidden.

const POLL_MS = 10_000;

export interface MissionControlComms {
  inbound: DriverInboundMessage[];
  outbound: DriverOutboundMessage[];
  statuses: Record<string, AssignmentStatusUpdate>;
  evidence: Record<string, VehicleEvidence>;
}

export interface MissionControlFeed {
  locations: DriverLocation[];
  comms: MissionControlComms;
  connection: "live" | "fallback" | "offline";
  lastCheckedAt: string | null;
  lastError: string | null;
  now: number;
}

const FeedContext = createContext<MissionControlFeed | null>(null);

interface ProviderProps {
  projectId: string;
  initialLocations: DriverLocation[];
  initialComms: MissionControlComms;
  children: ReactNode;
}

export function MissionControlFeedProvider({ projectId, initialLocations, initialComms, children }: ProviderProps) {
  const [locations, setLocations] = useState(initialLocations);
  const [comms, setComms] = useState(initialComms);
  const [connection, setConnection] = useState<MissionControlFeed["connection"]>("fallback");
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  // 0 until mounted — a Date.now() initializer differs between the SSR pass and
  // hydration and warns. The first effect sets the real clock.
  const [now, setNow] = useState(0);

  const liveRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const [locRes, commsRes] = await Promise.all([
        fetch(`/api/mission-control/locations?projectId=${projectId}`, { cache: "no-store" }).then((response) => response.json()),
        fetch(`/api/mission-control/comms?projectId=${projectId}`, { cache: "no-store" }).then((response) => response.json())
      ]);

      let failed = false;

      if (locRes?.success !== false && Array.isArray(locRes?.data)) {
        setLocations(locRes.data as DriverLocation[]);
      } else if (locRes?.success === false) {
        failed = true;
      }

      if (commsRes?.success && commsRes.data) {
        setComms((prev) => ({
          inbound: Array.isArray(commsRes.data.inbound) ? (commsRes.data.inbound as DriverInboundMessage[]) : prev.inbound,
          outbound: Array.isArray(commsRes.data.outbound) ? (commsRes.data.outbound as DriverOutboundMessage[]) : prev.outbound,
          statuses: commsRes.data.statuses ? { ...prev.statuses, ...(commsRes.data.statuses as Record<string, AssignmentStatusUpdate>) } : prev.statuses,
          evidence: commsRes.data.evidence ? { ...prev.evidence, ...(commsRes.data.evidence as Record<string, VehicleEvidence>) } : prev.evidence
        }));
      } else if (commsRes?.success === false) {
        failed = true;
      }

      setNow(Date.now());
      setLastCheckedAt(locRes?.checkedAt ?? commsRes?.checkedAt ?? new Date().toISOString());
      setLastError(failed ? locRes?.error || commsRes?.error || "โหลดข้อมูลศูนย์ควบคุมไม่สำเร็จ" : null);
      setConnection(failed ? "offline" : liveRef.current ? "live" : "fallback");
    } catch {
      setNow(Date.now());
      setLastCheckedAt(new Date().toISOString());
      setLastError("เชื่อมต่อข้อมูลศูนย์ควบคุมไม่ได้");
      setConnection("offline");
    }
  }, [projectId]);

  useEffect(() => {
    let disposed = false;
    setNow(Date.now());

    const channel = subscribeToDriverLocations(projectId, () => {
      liveRef.current = true;
      void refresh();
    });
    if (channel) {
      liveRef.current = true;
      setConnection("live");
    }

    const tick = () => {
      if (disposed) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      setNow(Date.now());
      void refresh();
    };

    const timer = window.setInterval(tick, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    void refresh();

    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribeMissionControl([channel]);
    };
  }, [projectId, refresh]);

  const value: MissionControlFeed = { locations, comms, connection, lastCheckedAt, lastError, now };
  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

/** Feed for a component always rendered inside the provider (fleet board, comms). */
export function useMissionControlFeed(): MissionControlFeed {
  const feed = useContext(FeedContext);
  if (!feed) throw new Error("useMissionControlFeed must be used inside <MissionControlFeedProvider>");
  return feed;
}

/** Feed for a component that may also be rendered standalone (the live map). */
export function useMissionControlFeedOptional(): MissionControlFeed | null {
  return useContext(FeedContext);
}
