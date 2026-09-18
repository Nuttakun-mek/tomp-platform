import { describe, expect, it } from "vitest";
import { createCaseSchema, updateCaseSchema } from "./case-schema";

function omit<T extends Record<string, unknown>>(source: T, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    if (!keys.includes(key)) result[key] = source[key];
  }
  return result;
}

// The real updateAirportTransferCase() call site never sends a "projectId"
// key at all (the edit form has no such field — a case can't change
// project). This pins updateCaseSchema.projectId staying `.optional()`: if
// a future edit to case-schema.ts accidentally makes it required again (or
// drops the override createCaseSchema.extend() needs), every case edit
// would start failing validation, and this test catches it before that
// reaches actions.ts.
const validUpdatePayloadWithoutProjectId = {
  caseId: "11111111-1111-4111-8111-111111111111",
  originalUpdatedAt: "2026-09-19T10:00:00.000Z",
  direction: "arrival",
  clientName: "",
  passengerTitle: "",
  passengerFirstName: "Somchai",
  passengerLastName: "Test",
  passengerEmail: "",
  passengerMobile: "",
  passengerCount: 1,
  luggageCount: 0,
  travelDate: "2026-09-20",
  flightNumber: "TG931",
  originAirport: "",
  destinationAirport: "",
  scheduledDepartureLocal: "",
  scheduledDepartureUtc: "",
  scheduledArrivalLocal: "",
  scheduledArrivalUtc: "",
  pickupName: "Suvarnabhumi Airport",
  pickupAddress: "",
  pickupMapsUrl: "",
  dropoffName: "Hotel",
  dropoffAddress: "",
  dropoffMapsUrl: "",
  confirmedPickupLocal: "",
  pickupTimeOverrideReason: "",
  vehicleType: "",
  vehiclePlate: "",
  driverName: "",
  driverPhone: "",
  notes: "",
  fastTrack: false,
  editReason: ""
};

// createCaseSchema has no caseId/originalUpdatedAt/editReason fields; strip
// them so the createCaseSchema tests below only exercise the projectId
// requirement, not shape drift from the update-only fields.
const validCreatePayloadShape = omit(validUpdatePayloadWithoutProjectId, ["caseId", "originalUpdatedAt", "editReason"]);

describe("updateCaseSchema", () => {
  it("accepts a valid edit payload with no projectId key at all", () => {
    const result = updateCaseSchema.safeParse(validUpdatePayloadWithoutProjectId);
    expect(result.success).toBe(true);
  });

  it("still rejects an edit payload missing a genuinely required field", () => {
    const withoutRequiredField = omit(validUpdatePayloadWithoutProjectId, ["passengerFirstName"]);
    const result = updateCaseSchema.safeParse(withoutRequiredField);
    expect(result.success).toBe(false);
  });
});

describe("createCaseSchema", () => {
  it("still requires projectId when creating a new case (the field this whole task added)", () => {
    const result = createCaseSchema.safeParse(validCreatePayloadShape);
    expect(result.success).toBe(false);
  });

  it("accepts a valid create payload once projectId is present", () => {
    const result = createCaseSchema.safeParse({ ...validCreatePayloadShape, projectId: "22222222-2222-4222-8222-222222222222" });
    expect(result.success).toBe(true);
  });
});
