export function checkCallSignRequired(callSign?: string | null): boolean {
  return Boolean(callSign?.trim());
}

export function checkCallSignUniqueWithinProject(callSign: string, existingCallSigns: string[]): boolean {
  const normalized = callSign.trim().toLowerCase();
  return !existingCallSigns.some((existing) => existing.trim().toLowerCase() === normalized);
}

export interface CallSignCrewInput {
  driverId?: string | null;
  vehicleId?: string | null;
}

export function isCallSignCrewed(input: CallSignCrewInput): boolean {
  return Boolean(input.driverId && input.vehicleId);
}

export function getMissingCallSignCrewItems(input: CallSignCrewInput): Array<"driver" | "vehicle"> {
  const missing: Array<"driver" | "vehicle"> = [];
  if (!input.driverId) missing.push("driver");
  if (!input.vehicleId) missing.push("vehicle");
  return missing;
}

export function assertAssignmentCrewMatchesCallSign(
  callSignCrew: CallSignCrewInput,
  assignmentCrew: CallSignCrewInput
): { ok: true } | { ok: false; reason: string } {
  if (!isCallSignCrewed(callSignCrew)) {
    return { ok: false, reason: "Call Sign ยังไม่ได้ผูกคนขับและรถ" };
  }

  if (assignmentCrew.driverId && assignmentCrew.driverId !== callSignCrew.driverId) {
    return { ok: false, reason: "คนขับของงานไม่ตรงกับ Call Sign ที่เลือก" };
  }

  if (assignmentCrew.vehicleId && assignmentCrew.vehicleId !== callSignCrew.vehicleId) {
    return { ok: false, reason: "รถของงานไม่ตรงกับ Call Sign ที่เลือก" };
  }

  return { ok: true };
}
