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
  passengerTitle: string | null;
  passengerFirstName: string;
  passengerLastName: string;
  passengerName: string;
  passengerEmail: string | null;
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
  pickupAddress: string | null;
  pickupMapsUrl: string | null;
  dropoffName: string;
  dropoffAddress: string | null;
  dropoffMapsUrl: string | null;
  recommendedPickupAt: string | null;
  confirmedPickupAt: string | null;
  pickupTimeOverrideReason: string | null;
  vehicleType: string | null;
  vehiclePlate: string | null;
  driverName: string | null;
  driverPhone: string | null;
  fastTrack: boolean;
  notes: string | null;
  verificationStatus: AirportTransferVerificationStatus;
  flightProviderCheckedAt: string | null;
  operationalStatus: AirportTransferOperationalStatus;
  nextActionAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  deletedAt: string | null;
  deleteReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AirportTransferAuditLog {
  id: string;
  action: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string | null;
  actorName: string | null;
  occurredAt: string;
}

export interface AirportTransferFlightSnapshot {
  providerStatus: string | null;
  observedAt: string;
  scheduledDepartureAt: string | null;
  estimatedDepartureAt: string | null;
  actualDepartureAt: string | null;
  scheduledArrivalAt: string | null;
  estimatedArrivalAt: string | null;
  actualArrivalAt: string | null;
}

export interface AirportTransferApiHealth {
  provider: string;
  connectionStatus: "not_configured" | "idle" | "checking" | "healthy" | "degraded" | "error" | "paused";
  pollingEnabled: boolean;
  pollingIntervalMinutes: number;
  activeCaseCount: number;
  checkedCaseCount: number;
  failedCaseCount: number;
  lastCheckAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  nextCheckAt: string | null;
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
