"use client";

import { useState } from "react";
import { createProjectSchema } from "@/lib/validation";

export function CreateProjectForm() {
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    const parsed = createProjectSchema.safeParse({
      organizationId: "10000000-0000-4000-8000-000000000001",
      projectCode: formData.get("projectCode"),
      projectName: formData.get("projectName"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      timezone: formData.get("timezone"),
      serviceLevel: formData.get("serviceLevel")
    });

    setMessage(parsed.success ? "Project draft validated. Write is deferred." : "Please complete required project fields.");
  }

  return (
    <form action={handleSubmit} className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-ink">Create Project</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Sprint 1 form foundation only. Submission is not wired to the database yet.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Project code
          <input className="rounded-md border border-slate-300 px-3 py-2" name="projectCode" placeholder="TOMP-2026-001" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Project name
          <input className="rounded-md border border-slate-300 px-3 py-2" name="projectName" placeholder="Global Summit Transport" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Start date
          <input className="rounded-md border border-slate-300 px-3 py-2" name="startDate" type="date" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          End date
          <input className="rounded-md border border-slate-300 px-3 py-2" name="endDate" type="date" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Timezone
          <input className="rounded-md border border-slate-300 px-3 py-2" name="timezone" defaultValue="Asia/Bangkok" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Service level
          <select className="rounded-md border border-slate-300 px-3 py-2" name="serviceLevel" defaultValue="standard">
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
            <option value="vip">VIP</option>
          </select>
        </label>
      </div>
      {message ? <p className="text-sm font-medium text-slate-700">{message}</p> : null}
      <button className="w-fit rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" type="submit">
        Save Draft Project
      </button>
    </form>
  );
}
