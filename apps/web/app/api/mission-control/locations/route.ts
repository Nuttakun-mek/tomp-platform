import { NextResponse } from "next/server";
import { getLatestDriverLocationsByProjectId } from "@/lib/data/locations";
import { demoProject } from "@/lib/demo/demo-kernel";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || demoProject.id;
  const locations = await getLatestDriverLocationsByProjectId(projectId);

  return NextResponse.json({ success: true, data: locations });
}
