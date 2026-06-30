import { NextResponse } from "next/server";
import { getLatestDriverLocations, getLatestDriverLocationsByProjectId } from "@/lib/data/locations";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const locations = projectId ? await getLatestDriverLocationsByProjectId(projectId) : await getLatestDriverLocations();

  return NextResponse.json({ success: true, data: locations });
}
