"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Handler = (event: { table: string; eventType: string }) => void;

function subscribe(table: string, projectId: string, handler: Handler) {
  let supabase;
  try {
    supabase = createSupabaseBrowserClient();
  } catch {
    return null;
  }

  return supabase
    .channel(`mission-control:${table}:${projectId}`)
    .on("postgres_changes", { event: "*", schema: "public", table, filter: `project_id=eq.${projectId}` }, (payload) => {
      handler({ table, eventType: payload.eventType });
    })
    .subscribe();
}

export function subscribeToTimelineEvents(projectId: string, handler: Handler) {
  return subscribe("timeline_events", projectId, handler);
}

export function subscribeToAssignmentStatusUpdates(projectId: string, handler: Handler) {
  return subscribe("assignment_status_updates", projectId, handler);
}

export function subscribeToDriverCheckins(projectId: string, handler: Handler) {
  return subscribe("driver_checkins", projectId, handler);
}

export function subscribeToVehicleCheckins(projectId: string, handler: Handler) {
  return subscribe("vehicle_checkins", projectId, handler);
}

export function subscribeToDriverLocations(projectId: string, handler: Handler) {
  return subscribe("gps_locations", projectId, handler);
}

export function unsubscribeMissionControl(channels: Array<ReturnType<typeof subscribe>>) {
  let supabase;
  try {
    supabase = createSupabaseBrowserClient();
  } catch {
    return;
  }

  channels.filter((channel): channel is NonNullable<typeof channel> => Boolean(channel)).forEach((channel) => {
    void supabase.removeChannel(channel);
  });
}
