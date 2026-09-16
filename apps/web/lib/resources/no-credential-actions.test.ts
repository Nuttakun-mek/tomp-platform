import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const forbiddenActions = new Set(["call-signs", "driver-access", "observer-access"]);

function walk(relativePath: string): string[] {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const next = path.join(absolute, entry.name);
    if (entry.isDirectory()) return walk(path.relative(root, next));
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [next] : [];
  });
}

describe("resources credential boundary", () => {
  it("does not import call sign or QR issuing actions", () => {
    const files = walk("components/resources");
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      const imports = [...source.matchAll(/from "@\/app\/actions\/([\w-]+)"/g)].map((match) => match[1]);
      const forbidden = imports.filter((name) => forbiddenActions.has(name));
      expect(forbidden, path.relative(root, file)).toEqual([]);
    }
  });
});
