import type { DriverLocation } from "@tomp/types/domain";
import { LiveLocationMap } from "./live-location-map";

export function LiveMapPanel({ projectId, locations }: { projectId: string; locations: DriverLocation[] }) {
  return <LiveLocationMap projectId={projectId} initialLocations={locations} />;
}
