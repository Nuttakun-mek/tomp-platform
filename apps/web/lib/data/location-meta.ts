import type { DriverLocation } from "@tomp/types/domain";

// Driver locations and assignments carry a free-form `metadata` bag. Reading a
// string out of it with a fallback was reimplemented in the live map, the fleet
// map and the driver task view — same three lines, three times.

/** Coerce an unknown metadata value to a non-empty trimmed string, or the fallback. */
export function metaString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

/** Read `location.metadata[key]` as a string, or the fallback. */
export function locationMetaText(location: DriverLocation, key: string, fallback: string): string {
  return metaString(location.metadata[key], fallback);
}
