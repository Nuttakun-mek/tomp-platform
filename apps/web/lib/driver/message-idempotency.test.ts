import { describe, expect, it } from "vitest";
import {
  createDriverMessageClientEventId,
  extractDriverMessageClientEventId,
  normalizeDriverMessageClientEventId
} from "./message-idempotency";

describe("driver message idempotency", () => {
  it("creates compact client event ids for messages and issues", () => {
    const id = createDriverMessageClientEventId("message", new Date("2026-09-16T09:00:00.000Z"));
    expect(id).toMatch(/^driver-message:20260916T090000000Z:/);
    expect(normalizeDriverMessageClientEventId(id)).toBe(id);
  });

  it("rejects unsafe or oversized ids", () => {
    expect(normalizeDriverMessageClientEventId("")).toBeNull();
    expect(normalizeDriverMessageClientEventId("../bad")).toBeNull();
    expect(normalizeDriverMessageClientEventId("x".repeat(121))).toBeNull();
  });

  it("extracts the id from metadata", () => {
    expect(extractDriverMessageClientEventId({ clientEventId: "driver-message:one" })).toBe("driver-message:one");
    expect(extractDriverMessageClientEventId({ clientEventId: "bad id" })).toBeNull();
  });
});
