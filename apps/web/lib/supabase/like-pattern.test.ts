import { describe, expect, it } from "vitest";
import { escapeLikePattern } from "./like-pattern";

describe("escapeLikePattern", () => {
  it("escapes the LIKE wildcards and the escape character", () => {
    expect(escapeLikePattern("a_min@x.com")).toBe("a\\_min@x.com");
    expect(escapeLikePattern("100%@x.com")).toBe("100\\%@x.com");
    expect(escapeLikePattern("back\\slash@x.com")).toBe("back\\\\slash@x.com");
  });

  it("leaves an ordinary address alone", () => {
    expect(escapeLikePattern("Driver.One@Example.com")).toBe("Driver.One@Example.com");
  });
});
