export function readCleanEnv(...keys: string[]) {
  for (const key of keys) {
    const raw = process.env[key];
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
