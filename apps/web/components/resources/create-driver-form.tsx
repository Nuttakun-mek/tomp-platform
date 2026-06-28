"use client";

import { useState } from "react";
import { createDriverSchema } from "@/lib/validation";

export function CreateDriverForm() {
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    const parsed = createDriverSchema.safeParse({
      organizationId: "10000000-0000-4000-8000-000000000001",
      fullName: formData.get("fullName"),
      phone: formData.get("phone"),
      licenseType: formData.get("licenseType") || null,
      languages: []
    });

    setMessage(parsed.success ? "Driver draft validated. Write is deferred." : "Please complete required driver fields.");
  }

  return (
    <form action={handleSubmit} className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Create Driver</h2>
      <input className="rounded-md border border-slate-300 px-3 py-2" name="fullName" placeholder="Full name" />
      <input className="rounded-md border border-slate-300 px-3 py-2" name="phone" placeholder="Phone" />
      <input className="rounded-md border border-slate-300 px-3 py-2" name="licenseType" placeholder="License type" />
      {message ? <p className="text-sm font-medium text-slate-700">{message}</p> : null}
      <button className="w-fit rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" type="submit">Save Draft Driver</button>
    </form>
  );
}
