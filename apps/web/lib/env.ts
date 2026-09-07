import fs from "fs";
import path from "path";

let localEnvCache: Record<string, string> | null = null;

function parseEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return {};

  const entries: Record<string, string> = {};
  const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim().replace(/^\uFEFF/, "");
    const value = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .replace(/^\uFEFF/, "")
      .trim();
    if (key && value) entries[key] = value;
  }
  return entries;
}

function readLocalEnvFallback() {
  if (localEnvCache) return localEnvCache;

  const candidates = [path.join(process.cwd(), ".env.local"), path.join(process.cwd(), "..", "..", ".env.local")];
  localEnvCache = candidates.reduce<Record<string, string>>((accumulator, candidate) => ({ ...accumulator, ...parseEnvFile(candidate) }), {});
  return localEnvCache;
}

export function readCleanEnv(...keys: string[]) {
  for (const key of keys) {
    const raw = process.env[key] ?? readLocalEnvFallback()[key];
    if (raw == null) continue;
    const value = raw
      .replace(/^\uFEFF/, "")
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .replace(/^\uFEFF/, "")
      .trim();
    if (value) return value;
  }
  return undefined;
}
