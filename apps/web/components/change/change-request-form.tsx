"use client";

import { useState } from "react";
import { createChangeRequestAction } from "@/app/actions/change-requests";

export function ChangeRequestForm({ projectId }: { projectId: string }) {
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    const result = await createChangeRequestAction({
      projectId,
      objectType: formData.get("objectType"),
      severity: formData.get("severity"),
      reason: formData.get("reason"),
      impactSummary: formData.get("impactSummary") || null
    });

    setMessage(result.success ? result.warning || "Change request created." : result.error || "Change request failed.");
  }

  return (
    <form action={handleSubmit} className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Change Request</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <input className="rounded-md border border-slate-300 px-3 py-2" name="objectType" placeholder="assignment" defaultValue="assignment" />
        <select className="rounded-md border border-slate-300 px-3 py-2" name="severity" defaultValue="medium">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>
      <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2" name="reason" placeholder="Why this change is needed after publish" />
      <textarea className="min-h-20 rounded-md border border-slate-300 px-3 py-2" name="impactSummary" placeholder="Operational impact summary" />
      {message ? <p className="text-sm font-medium text-slate-700">{message}</p> : null}
      <button className="w-fit rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" type="submit">
        Create Change Request
      </button>
    </form>
  );
}

