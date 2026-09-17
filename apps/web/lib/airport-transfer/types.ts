export type AirportTransferDirection = "arrival" | "departure";

export type AirportTransferVerificationStatus =
  | "pending"
  | "verified"
  | "partial_match"
  | "route_mismatch"
  | "date_mismatch"
  | "multiple_matches"
  | "not_found"
  | "manual_confirmed"
  | "needs_recheck"
  | "provider_unavailable";

export type AirportTransferOperationalStatus =
  | "draft"
  | "needs_review"
  | "verified"
  | "ready_to_assign"
  | "assigned"
  | "driver_notified"
  | "driver_confirmed"
  | "vehicle_en_route"
  | "vehicle_arrived"
  | "passenger_met"
  | "passenger_on_board"
  | "en_route"
  | "arrived_destination"
  | "completed"
  | "issue"
  | "cancelled";

export interface AirportTransferCase {
  id: string;
  caseCode: string;
  direction: AirportTransferDirection;
  clientName: string | null;
  passengerName: string;
  passengerMobile: string | null;
  passengerCount: number;
  luggageCount: number;
  travelDate: string;
  flightNumber: string;
  originAirport: string | null;
  destinationAirport: string | null;
  scheduledDepartureAt: string | null;
  scheduledArrivalAt: string | null;
  pickupName: string;
  dropoffName: string;
  recommendedPickupAt: string | null;
  confirmedPickupAt: string | null;
  vehicleType: string | null;
  vehiclePlate: string | null;
  driverName: string | null;
  driverPhone: string | null;
  verificationStatus: AirportTransferVerificationStatus;
  operationalStatus: AirportTransferOperationalStatus;
  nextActionAt: string | null;
  createdAt: string;
}

export interface AirportTransferSummary {
  total: number;
  actionRequired: number;
  unassigned: number;
  verificationIssues: number;
  completed: number;
}

export interface AirportTransferTask {
  id: string;
  taskKey: string;
  label: string;
  ownerRole: string;
  sequence: number;
  status: "pending" | "completed" | "skipped" | "cancelled";
  completedAt: string | null;
  note: string | null;
}
