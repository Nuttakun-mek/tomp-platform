"use client";

import { useState } from "react";
import { driverCheckinAction, vehicleCheckinAction } from "@/app/actions/driver";
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

    setMessage(driverResult.success && vehicleResult.success ? "Activation submitted." : driverResult.error || vehicleResult.error || "Activation failed.");
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
      {message ? <p className="mt-3 text-sm font-medium text-slate-700">{message}</p> : null}
      <button className="mt-4 rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" type="submit">
        Submit Activation
      </button>
    </form>
  );
}
