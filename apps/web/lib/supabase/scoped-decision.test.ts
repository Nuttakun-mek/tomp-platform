import { describe, expect, it } from "vitest";
import { scopedReadsFlagOn, shouldUseScopedClient } from "./scoped-decision";

describe("scopedReadsFlagOn", () => {
  it("is on by default", () => {
    expect(scopedReadsFlagOn({} as NodeJS.ProcessEnv)).toBe(true);
    expect(scopedReadsFlagOn({ TOMP_SCOPED_READS: "1" } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });
  it("is off only for an explicit '0'", () => {
    expect(scopedReadsFlagOn({ TOMP_SCOPED_READS: "0" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(scopedReadsFlagOn({ TOMP_SCOPED_READS: " 0 " } as unknown as NodeJS.ProcessEnv)).toBe(false);
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
