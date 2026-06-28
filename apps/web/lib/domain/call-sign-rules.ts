export function checkCallSignRequired(callSign?: string | null): boolean {
  return Boolean(callSign?.trim());
}

export function checkCallSignUniqueWithinProject(callSign: string, existingCallSigns: string[]): boolean {
  const normalized = callSign.trim().toLowerCase();
  return !existingCallSigns.some((existing) => existing.trim().toLowerCase() === normalized);
}
