import { describe, expect, it } from "vitest";
import { scopedReadsFlagOn, shouldUseScopedClient } from "./scoped-decision";

describe("scopedReadsFlagOn", () => {
  it("is false when unset", () => {
    expect(scopedReadsFlagOn({} as NodeJS.ProcessEnv)).toBe(false);
  });
  it("is false for values other than 1", () => {
    expect(scopedReadsFlagOn({ TOMP_SCOPED_READS: "true" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(scopedReadsFlagOn({ TOMP_SCOPED_READS: "0" } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
  it("is true for '1' (trimmed)", () => {
    expect(scopedReadsFlagOn({ TOMP_SCOPED_READS: " 1 " } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });
});

describe("shouldUseScopedClient", () => {
  it("requires both flag and session", () => {
    expect(shouldUseScopedClient(true, true)).toBe(true);
    expect(shouldUseScopedClient(true, false)).toBe(false);
    expect(shouldUseScopedClient(false, true)).toBe(false);
    expect(shouldUseScopedClient(false, false)).toBe(false);
  });
});
