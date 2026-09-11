import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function walk(relativePath: string): string[] {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const next = path.join(absolute, entry.name);
    if (entry.isDirectory()) return walk(path.relative(root, next));
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [next] : [];
  });
}

describe("fleet view read-only guard", () => {
  it("imports no mutating server actions except the PIN gate", () => {
    const files = [...walk("components/fleet-view"), ...walk("app/fleet")];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      const imports = [...source.matchAll(/from "@\/app\/actions\/([\w-]+)"/g)].map((match) => match[1]);
      expect(imports.filter((name) => name !== "fleet-pin"), path.relative(root, file)).toEqual([]);
    }
  });
});
