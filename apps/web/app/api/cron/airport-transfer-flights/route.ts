import { timingSafeEqual } from "crypto";
import { syncActiveAirportTransferFlights } from "@/lib/airport-transfer/flight-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.AIRPORT_TRANSFER_SYNC_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") || "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  const result = await syncActiveAirportTransferFlights();
  return Response.json(result, { status: result.ok || result.status === "idle" || result.status === "paused" ? 200 : 503 });
}
