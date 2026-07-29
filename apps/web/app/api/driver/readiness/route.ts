import { NextResponse } from "next/server";
import { driverCheckinAction } from "@/app/actions/driver";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = await driverCheckinAction(body);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
