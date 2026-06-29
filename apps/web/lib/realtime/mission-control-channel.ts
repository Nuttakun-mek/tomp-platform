"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type MissionControlRealtimeEvent = {
  table: string;
  eventType: string;
};

export function subscribeToMissionControl(projectId: string, onEvent: (event: MissionControlRealtimeEvent) => void): () => void {
  let supabase;
  try {
    supabase = createSupabaseBrowserClient();
  } catch {
    return () => undefined;
  }

  const channel = supabase
    .channel(`mission-control:${projectId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "timeline_events", filter: `project_id=eq.${projectId}` }, (payload) => {
      onEvent({ table: "timeline_events", eventType: payload.eventType });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "assignment_status_updates", filter: `project_id=eq.${projectId}` }, (payload) => {
      onEvent({ table: "assignment_status_updates", eventType: payload.eventType });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "driver_issue_reports", filter: `project_id=eq.${projectId}` }, (payload) => {
      onEvent({ table: "driver_issue_reports", eventType: payload.eventType });
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

