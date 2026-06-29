"use client";

import { useState } from "react";
import { driverCheckinAction, vehicleCheckinAction, vehiclePhotoUploadAction } from "@/app/actions/driver";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";

export function DriverActivationChecklist({ driverAccess }: { driverAccess?: DriverAccessAssignment }) {
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    if (!driverAccess) {
      setMessage("Driver access data is not available.");
      return;
    }

    const driverResult = await driverCheckinAction({
      projectId: driverAccess.project.id,
      assignmentId: driverAccess.assignment.id,
      driverId: driverAccess.driver.id,
      status: "ready",
      confirmedName: formData.get("confirmedName") === "on",
      confirmedPhone: formData.get("confirmedPhone") === "on",
      confirmedVehicle: formData.get("confirmedVehicle") === "on",
      gpsConsent: formData.get("gpsConsent") === "on",
      metadata: {
        vehiclePhotoCaptured: formData.get("vehiclePhotoCaptured") === "on",
        platePhotoCaptured: formData.get("platePhotoCaptured") === "on"
      }
    });

    const vehicleResult = await vehicleCheckinAction({
      projectId: driverAccess.project.id,
      assignmentId: driverAccess.assignment.id,
      vehicleId: driverAccess.vehicle.id,
      driverId: driverAccess.driver.id,
      status: "confirmed",
      photoUrl: null,
      platePhotoUrl: null,
      metadata: {
        photoPlaceholder: formData.get("vehiclePhotoCaptured") === "on",
        platePhotoPlaceholder: formData.get("platePhotoCaptured") === "on"
      }
    });
    const photoFormData = new FormData();
    photoFormData.set("projectId", driverAccess.project.id);
    photoFormData.set("assignmentId", driverAccess.assignment.id);
    const vehiclePhoto = formData.get("vehiclePhoto");
    const platePhoto = formData.get("platePhoto");
    if (vehiclePhoto instanceof File) photoFormData.set("vehiclePhoto", vehiclePhoto);
    if (platePhoto instanceof File) photoFormData.set("platePhoto", platePhoto);
    const photoResult = await vehiclePhotoUploadAction(photoFormData);

    setMessage(driverResult.success && vehicleResult.success && photoResult.success ? photoResult.warning || "Activation submitted." : driverResult.error || vehicleResult.error || photoResult.error || "Activation failed.");
  }

  const checklist = [
    ["confirmedName", "Confirm name"],
    ["confirmedPhone", "Confirm phone"],
    ["confirmedVehicle", "Confirm vehicle"],
    ["gpsConsent", "GPS consent placeholder"],
    ["vehiclePhotoCaptured", "Vehicle photo placeholder"],
    ["platePhotoCaptured", "Plate photo placeholder"]
  ] as const;

  return (
    <form action={handleSubmit} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Activation Checklist</h2>
      <div className="mt-4 grid gap-3">
        {checklist.map(([name, label]) => (
          <label key={name} className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <input name={name} type="checkbox" className="h-4 w-4" />
            {label}
          </label>
        ))}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Vehicle photo
          <input className="rounded-md border border-slate-300 px-3 py-2" name="vehiclePhoto" type="file" accept="image/png,image/jpeg,image/webp" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Plate photo
          <input className="rounded-md border border-slate-300 px-3 py-2" name="platePhoto" type="file" accept="image/png,image/jpeg,image/webp" />
        </label>
      </div>
      {message ? <p className="mt-3 text-sm font-medium text-slate-700">{message}</p> : null}
      <button className="mt-4 rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" type="submit">
        Submit Activation
      </button>
    </form>
  );
}
