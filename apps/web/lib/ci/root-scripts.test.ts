import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// apps/mobile-driver is an Expo app with its own lockfile, not an npm workspace,
// so the root `npm ci` never installs its dependencies and CI installs them in a
// later step. Anything that needs them therefore cannot live in a root script
// that runs before that install — and its tsconfig extends "expo/tsconfig.base",
// which resolves inside apps/mobile-driver/node_modules, so both tsc and vitest
// fail before reading a single line of code.
//
// This has been got wrong three times: 5aa2110 folded the mobile tests into the
// root `test` script, 736dd1f undid it, and 4113f31 put back both that line and
// the same thing for `typecheck`. Every time it passed locally, because a
// developer machine already has apps/mobile-driver/node_modules from the last
// time someone ran the app — the one environment where the bug cannot reproduce
// is the one where the change gets written.
//
// The mobile suites are not skipped; CI runs them in their own steps, after the
// install, via the test:mobile and typecheck:mobile scripts.

const ROOT_PACKAGE = path.resolve(__dirname, "../../../../package.json");

describe("root npm scripts", () => {
  const scripts = JSON.parse(fs.readFileSync(ROOT_PACKAGE, "utf8")).scripts as Record<string, string>;

  it.each(["typecheck", "test", "lint", "build"])(
    "%s does not reach into apps/mobile-driver",
    (name) => {
      expect(scripts[name], `root "${name}" script`).not.toContain("apps/mobile-driver");
    }
  );

  it("keeps the mobile suites available under their own scripts", () => {
    expect(scripts["test:mobile"]).toContain("apps/mobile-driver");
    expect(scripts["typecheck:mobile"]).toContain("apps/mobile-driver");
  });
});
