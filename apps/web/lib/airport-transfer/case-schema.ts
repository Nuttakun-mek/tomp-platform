import { z } from "zod";

// Pulled out of actions.ts (a "use server" file, which may only export async
// functions) so these schemas can be imported directly by a schema-level
// test — no DB, no server action boundary, just zod.

export const optionalText = z.string().trim().transform((value) => value || null);

export const createCaseSchema = z.object({
  direction: z.enum(["arrival", "departure"]),
  projectId: z.string().uuid("กรุณาเลือกโครงการ"),
  clientName: optionalText,
  passengerTitle: optionalText,
  passengerFirstName: z.string().trim().min(1, "กรุณากรอกชื่อผู้โดยสาร"),
  passengerLastName: z.string().trim().min(1, "กรุณากรอกนามสกุลผู้โดยสาร"),
  passengerEmail: z.union([z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง"), z.literal("")]).transform((value) => value || null),
  passengerMobile: optionalText,
  passengerCount: z.coerce.number().int().min(1).max(99),
  luggageCount: z.coerce.number().int().min(0).max(999),
  travelDate: z.string().date("กรุณาระบุวันเดินทาง"),
  flightNumber: z.string().trim().min(2, "กรุณากรอกหมายเลขเที่ยวบิน").max(10).transform((value) => value.replace(/\s+/g, "").toUpperCase()),
  originAirport: optionalText.transform((value) => value?.toUpperCase() || null),
  destinationAirport: optionalText.transform((value) => value?.toUpperCase() || null),
  scheduledDepartureLocal: optionalText,
  scheduledDepartureUtc: optionalText,
  scheduledArrivalLocal: optionalText,
  scheduledArrivalUtc: optionalText,
  pickupName: z.string().trim().min(1, "กรุณาระบุจุดรับ"),
  pickupAddress: optionalText,
  pickupMapsUrl: optionalText,
  dropoffName: z.string().trim().min(1, "กรุณาระบุจุดส่ง"),
  dropoffAddress: optionalText,
  dropoffMapsUrl: optionalText,
  confirmedPickupLocal: optionalText,
  pickupTimeOverrideReason: optionalText,
  vehicleType: optionalText,
  vehiclePlate: optionalText,
  driverName: optionalText,
  driverPhone: optionalText,
  notes: optionalText,
  fastTrack: z.boolean()
});

export const updateCaseSchema = createCaseSchema.extend({
  // The edit form never lets a case change project, so it never submits a
  // projectId field — override createCaseSchema's required one so an edit
  // isn't rejected for a field it was never asked to send.
  projectId: z.string().uuid().optional(),
  caseId: z.string().uuid(),
  originalUpdatedAt: z.string().datetime({ offset: true }),
  editReason: optionalText
});
