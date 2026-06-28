export interface TimeRangeInput {
  startTime?: string | null;
  endTime?: string | null;
}

export function checkAssignmentTimeRange({ startTime, endTime }: TimeRangeInput): boolean {
  if (!startTime || !endTime) {
    return true;
  }

  return new Date(endTime).getTime() >= new Date(startTime).getTime();
}

export function buildGoogleMapsDirectionsUrl(destination: string, origin?: string): string {
  const params = new URLSearchParams({
    api: "1",
    destination
  });

  if (origin) {
    params.set("origin", origin);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
