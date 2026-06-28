export interface GoogleMapsDirectionsInput {
  destination: string;
  origin?: string;
}

export function buildGoogleMapsDirectionsUrl({
  destination,
  origin
}: GoogleMapsDirectionsInput): string {
  const params = new URLSearchParams({
    api: "1",
    destination
  });

  if (origin) {
    params.set("origin", origin);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
