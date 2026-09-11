const UNIT_ACCENTS = [
  { spine: "bg-teal-500", chip: "bg-teal-600", border: "border-l-teal-500", soft: "bg-teal-50 text-teal-800" },
  { spine: "bg-indigo-500", chip: "bg-indigo-600", border: "border-l-indigo-500", soft: "bg-indigo-50 text-indigo-800" },
  { spine: "bg-amber-500", chip: "bg-amber-600", border: "border-l-amber-500", soft: "bg-amber-50 text-amber-900" },
  { spine: "bg-rose-500", chip: "bg-rose-600", border: "border-l-rose-500", soft: "bg-rose-50 text-rose-800" },
  { spine: "bg-sky-500", chip: "bg-sky-600", border: "border-l-sky-500", soft: "bg-sky-50 text-sky-800" },
  { spine: "bg-violet-500", chip: "bg-violet-600", border: "border-l-violet-500", soft: "bg-violet-50 text-violet-800" }
];

/** Stable per call sign, so a unit keeps its colour across refreshes. */
export function accentFor(callSign: string) {
  let hash = 0;
  for (const char of callSign) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return UNIT_ACCENTS[hash % UNIT_ACCENTS.length];
}
