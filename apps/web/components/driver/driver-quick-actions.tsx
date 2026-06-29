"use client";

import { useState } from "react";
import { assignmentStatusUpdateAction, driverIssueReportAction } from "@/app/actions/driver";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";

export function DriverQuickActions({ driverAccess, mapsUrl = "https://www.google.com/maps" }: { driverAccess?: DriverAccessAssignment; mapsUrl?: string }) {
  const [message, setMessage] = useState<string | null>(null);

  async function updateStatus(status: "ready" | "arrived_pickup" | "passenger_onboard" | "completed") {
    if (!driverAccess) {
      setMessage("Driver access data is not available.");
      return;
    }

    const result = await assignmentStatusUpdateAction({
      projectId: driverAccess.project.id,
      assignmentId: driverAccess.assignment.id,
      driverId: driverAccess.driver.id,
      status,
      source: "driver_qr"
    });
    setMessage(result.success ? `Status updated: ${status}` : result.error || "Status update failed.");
  }

  async function reportIssue() {
    if (!driverAccess) {
      setMessage("Driver access data is not available.");
      return;
    }

    const result = await driverIssueReportAction({
      projectId: driverAccess.project.id,
      assignmentId: driverAccess.assignment.id,
      driverId: driverAccess.driver.id,
      issueType: "driver_report",
      severity: "warning",
      message: "Driver reported an issue from the Driver Card."
    });
    setMessage(result.success ? "Issue reported." : result.error || "Issue report failed.");
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <button className="rounded-md bg-operation px-4 py-3 text-sm font-semibold text-white" onClick={() => updateStatus("ready")} type="button">Ready</button>
        <button className="rounded-md border border-operation px-4 py-3 text-sm font-semibold text-operation" onClick={() => updateStatus("arrived_pickup")} type="button">Arrived Pickup</button>
        <button className="rounded-md border border-operation px-4 py-3 text-sm font-semibold text-operation" onClick={() => updateStatus("passenger_onboard")} type="button">Passenger Onboard</button>
        <button className="rounded-md border border-operation px-4 py-3 text-sm font-semibold text-operation" onClick={() => updateStatus("completed")} type="button">Completed</button>
        <a className="rounded-md border border-route px-4 py-3 text-center text-sm font-semibold text-route" href={mapsUrl}>Open Google Maps</a>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <button className="rounded-md border border-amber-300 px-4 py-3 text-sm font-semibold text-amber-800" onClick={reportIssue} type="button">Report issue</button>
        <a className="rounded-md border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700" href="tel:+6620000000">Call coordinator</a>
        <a className="rounded-md border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700" href="tel:+6621111111">Call operation</a>
      </div>
      {message ? <p className="text-sm font-medium text-slate-700">{message}</p> : null}
    </div>
  );
}
