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

const THAI = /[฀-๿]/;

describe("fleet view read-only guard", () => {
  it("imports no mutating server actions except the PIN gate", () => {
    const files = [...walk("components/fleet-view"), ...walk("app/fleet")];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      const imports = [...source.matchAll(/from "@\/app\/actions\/([\w-]+)"/g)].map((match) => match[1]);
      expect(imports.filter((name) => name !== "fleet-pin"), path.relative(root, file)).toEqual([]);
    }
  });

  // The customer page is the one surface that has to work in both languages, and
  // it was first built with its own copy tables sitting beside an already
  // finished dictionary — two sets of translations for one page, free to drift,
  // with the dictionary looking complete to anyone reviewing it. The copy lives
  // in lib/i18n or the page is not translated at all.
  it("renders no Thai literal of its own — every string comes from the dictionary", () => {
    const files = [...walk("components/fleet-view"), ...walk("app/fleet")];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      const offending = source.split("\n").filter((line) => THAI.test(line));
      expect(offending, path.relative(root, file)).toEqual([]);
    }
  });
});
