import { describe, expect, it } from "vitest";
import {
  extractLocationClientEventId,
  isDuplicateLocationClientEventError,
  normalizeLocationClientEventId
} from "./location-idempotency";

describe("driver location idempotency", () => {
  it("accepts compact client event ids used by web and mobile", () => {
    expect(normalizeLocationClientEventId("gps:20260911T140600:abc-123")).toBe("gps:20260911T140600:abc-123");
  });

  it("rejects missing, long, and unsafe client event ids", () => {
    expect(normalizeLocationClientEventId("")).toBeNull();
    expect(normalizeLocationClientEventId("x".repeat(121))).toBeNull();
    expect(normalizeLocationClientEventId("gps event with spaces")).toBeNull();
  });

  it("extracts the id from metadata only", () => {
    expect(extractLocationClientEventId({ clientEventId: "web:one" })).toBe("web:one");
    expect(extractLocationClientEventId({ clientEventId: "../bad" })).toBeNull();
  });

  it("recognizes unique constraint errors as idempotent duplicates", () => {
    expect(isDuplicateLocationClientEventError({ code: "23505" })).toBe(true);
    expect(isDuplicateLocationClientEventError(new Error("gps_locations_client_event_id_unique"))).toBe(true);
    expect(isDuplicateLocationClientEventError(new Error("network failed"))).toBe(false);
  });
});
