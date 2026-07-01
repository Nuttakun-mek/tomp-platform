import type { RouteChangeInstruction, RoutePlan, RouteStop } from "@tomp/types/domain";

export function buildGoogleMapsDirectionsUrl(destination: string, origin?: string) {
  const params = new URLSearchParams({ api: "1", destination });
  if (origin) params.set("origin", origin);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildRouteInstructionSummary(stops: RouteStop[]) {
  if (!stops.length) return "ยังไม่มีข้อมูลเส้นทาง";
  return stops.map((stop, index) => `${index + 1}. ${stop.label}`).join(" → ");
}

export function compareRouteChangeImpact(oldRoute: RoutePlan, newRoute: RoutePlan) {
  const oldStops = oldRoute.stops.length;
  const newStops = newRoute.stops.length;
  if (oldStops !== newStops) return "จำนวนจุดแวะเปลี่ยนแปลง";
  if (oldRoute.summary !== newRoute.summary) return "รายละเอียดเส้นทางเปลี่ยนแปลง";
  return "ไม่มีผลกระทบสำคัญ";
}

export function getRouteChangeThaiMessage(instruction: RouteChangeInstruction) {
  return `แจ้งเปลี่ยนเส้นทาง: ${instruction.reason || "ศูนย์ควบคุมปรับแผนปฏิบัติการ"}`;
}
