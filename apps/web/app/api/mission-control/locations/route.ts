import { NextResponse } from "next/server";
import { withTimeout } from "@/lib/async/timeout";
import { guardProjectApi } from "@/lib/api/guard";
import { getLatestDriverLocations, getLatestDriverLocationsByProjectId } from "@/lib/data/locations";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");

  const denied = await guardProjectApi();
  if (denied) return denied;

  try {
    const locations = await withTimeout(projectId ? getLatestDriverLocationsByProjectId(projectId) : getLatestDriverLocations(), 9000, "driver locations");

    return NextResponse.json({ success: true, data: locations, checkedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({
      success: false,
      data: [],
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "โหลดตำแหน่งคนขับไม่สำเร็จ"
    });
  }
}
