import { describe, expect, it } from "vitest";
import { buildDriverAccessUrl } from "../url";

describe("driver access URL", () => {
  it("builds a driver token URL", () => {
    expect(buildDriverAccessUrl({ token: "token-1", baseUrl: "https://tomp.example" })).toBe("https://tomp.example/ground-transfer/driver?token=token-1");
  });

  it("puts the site first and the token in the query, whatever order the names come in", () => {
    const url = new URL(buildDriverAccessUrl({ baseUrl: "https://tomp.example/", token: "tomp_a_b_c" }));
    expect(url.origin).toBe("https://tomp.example");
    expect(url.pathname).toBe("/ground-transfer/driver");
    expect(url.searchParams.get("token")).toBe("tomp_a_b_c");
  });
});
