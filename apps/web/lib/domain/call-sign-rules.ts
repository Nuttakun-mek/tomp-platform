export function checkCallSignRequired(callSign?: string | null): boolean {
  return Boolean(callSign?.trim());
}
