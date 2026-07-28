import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const ignored = new Set([".git", ".next", "node_modules", ".vercel"]);
const riskyPattern = /NEXT_PUBLIC_[A-Z0-9_]*(SERVICE|SECRET|SERVICE_ROLE)[A-Z0-9_]*/g;
const matches = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (ignored.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!/\.(ts|tsx|js|mjs|json|md|env|example)$/.test(entry)) continue;
    const text = readFileSync(fullPath, "utf8");
    const found = text.match(riskyPattern);
    if (found) {
      matches.push({ file: fullPath.replace(root, "."), keys: [...new Set(found)] });
    }
  }
}

walk(root);

if (matches.length > 0) {
  console.error("พบ environment variable ที่เสี่ยงเผยแพร่ secret ไป browser:");
  for (const match of matches) {
    console.error(`- ${match.file}: ${match.keys.join(", ")}`);
  }
  process.exit(1);
}

console.log("ไม่พบ NEXT_PUBLIC_* service/secret key ใน source");
