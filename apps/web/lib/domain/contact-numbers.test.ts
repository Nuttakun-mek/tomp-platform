import { describe, expect, it } from "vitest";
import { normalisePhone, resolveCoordinatorPhone, resolveOperationPhone, telHref } from "./contact-numbers";

describe("resolveCoordinatorPhone", () => {
  it("falls back to the project so a number is typed once, not once per job", () => {
    // The regression this exists for: the number lived only on the assignment,
    // was written by nothing but the seeders, and the driver's call button had
    // nothing to dial on real work.
    expect(resolveCoordinatorPhone({}, { coordinatorPhone: "02-123-4567" })).toBe("02-123-4567");
    expect(resolveCoordinatorPhone(null, { coordinatorPhone: "02-123-4567" })).toBe("02-123-4567");
  });

  it("lets a job with its own coordinator override the project", () => {
    expect(resolveCoordinatorPhone({ coordinatorPhone: "081-000-0000" }, { coordinatorPhone: "02-123-4567" })).toBe("081-000-0000");
  });

  it("accepts the snake_case spelling that older rows use", () => {
    expect(resolveCoordinatorPhone({ coordinator_phone: "081-111-1111" }, {})).toBe("081-111-1111");
    expect(resolveCoordinatorPhone({}, { coordinator_phone: "02-999-9999" })).toBe("02-999-9999");
  });

  it("is empty when nobody set one, so the caller can hide the button", () => {
    expect(resolveCoordinatorPhone({}, {})).toBe("");
    expect(resolveCoordinatorPhone(null, null)).toBe("");
  });

  it("treats a placeholder with no digits as unset", () => {
    // "ยังไม่ระบุ" used to reach the UI as if it were a number.
    expect(resolveCoordinatorPhone({ coordinatorPhone: "ยังไม่ระบุ" }, {})).toBe("");
    expect(resolveCoordinatorPhone({ coordinatorPhone: "   " }, { coordinatorPhone: "02-1" })).toBe("02-1");
  });

  it("keeps the operations line separate from the coordinator", () => {
    const assignment = { coordinatorPhone: "081-111-1111", operationPhone: "02-222-2222" };
    expect(resolveCoordinatorPhone(assignment, {})).toBe("081-111-1111");
    expect(resolveOperationPhone(assignment, {})).toBe("02-222-2222");
  });
});

describe("normalisePhone", () => {
  it("keeps the shapes people actually type", () => {
    expect(normalisePhone("+66 2 123 4567")).toBe("+66 2 123 4567");
    expect(normalisePhone("(02) 123-4567")).toBe("(02) 123-4567");
  });

  it("drops anything that is not part of a number", () => {
    expect(normalisePhone("โทร 02-123-4567")).toBe("02-123-4567");
    expect(normalisePhone(12345)).toBe("");
    expect(normalisePhone(undefined)).toBe("");
  });
});

describe("telHref", () => {
  it("strips formatting for dialling", () => {
    expect(telHref("+66 2 123 4567")).toBe("tel:+6621234567");
    expect(telHref("(02) 123-4567")).toBe("tel:021234567");
  });

  it("refuses something too short to be a number", () => {
    expect(telHref("12")).toBeNull();
    expect(telHref("")).toBeNull();
  });
});
