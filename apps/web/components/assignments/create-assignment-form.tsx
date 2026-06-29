"use client";

import { useState } from "react";
import { createAssignmentAction } from "@/app/actions/assignments";
import { createAssignmentSchema } from "@/lib/validation";

export function CreateAssignmentForm({ projectId = "10000000-0000-4000-8000-000000000003" }: { projectId?: string }) {
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    const parsed = createAssignmentSchema.safeParse({
      projectId,
      missionId: "10000000-0000-4000-8000-000000000006",
      callSignId: "10000000-0000-4000-8000-000000000007",
      driverId: null,
      vehicleId: null,
      startTime: formData.get("startTime") || null,
      endTime: formData.get("endTime") || null
    });

    if (!parsed.success) {
      setMessage("Assignment validation failed.");
      return;
    }

    const result = await createAssignmentAction(parsed.data);
    setMessage(result.success ? result.warning || "Assignment created and timeline prepared." : result.error || "Assignment create failed.");
  }

  return (
    <form action={handleSubmit} className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-ink">Create Assignment</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Connect mission, call sign, driver, vehicle, and time window through a server-side write action.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Mission code" />
        <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Call sign" />
        <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Driver" />
        <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Vehicle" />
        <input className="rounded-md border border-slate-300 px-3 py-2" name="startTime" type="datetime-local" />
        <input className="rounded-md border border-slate-300 px-3 py-2" name="endTime" type="datetime-local" />
      </div>
      {message ? <p className="text-sm font-medium text-slate-700">{message}</p> : null}
      <button className="w-fit rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" type="submit">
        Save Draft Assignment
      </button>
    </form>
  );
}
