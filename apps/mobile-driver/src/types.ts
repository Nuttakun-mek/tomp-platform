import type { Assignment, CallSign, Driver, DriverAssignmentPacket, DriverNotification, Project, RouteChangeInstruction, Vehicle } from "@tomp/types/domain";

export interface DriverRouteSummary {
  pickupLabel: string;
  dropoffLabel: string;
  commitmentTime: string;
  mapsUrl: string;
}

export interface MobileDriverAssignment {
  token: string;
  packet: DriverAssignmentPacket;
  project: Project;
  assignment: Assignment;
  callSign: CallSign;
  driver: Driver;
  vehicle: Vehicle;
  route: DriverRouteSummary;
  notifications: DriverNotification[];
  routeChanges: RouteChangeInstruction[];
}

export type DriverScreenState = "token" | "loading" | "ready" | "error";
