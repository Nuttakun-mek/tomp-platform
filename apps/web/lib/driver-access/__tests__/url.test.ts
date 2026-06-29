import { describe, expect, it } from "vitest";
import { buildDriverAccessUrl } from "../url";

describe("driver access URL", () => {
  it("builds a driver token URL", () => {
    expect(buildDriverAccessUrl("token-1", "https://tomp.example")).toBe("https://tomp.example/driver/token-1");
  });
});
