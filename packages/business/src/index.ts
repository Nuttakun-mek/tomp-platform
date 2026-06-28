export const operatingStages = ["plan", "prepare", "operate", "adapt", "improve"] as const;

export type OperatingStage = (typeof operatingStages)[number];

export const canonicalConcepts = [
  "project",
  "mission",
  "assignment",
  "call-sign",
  "published-plan",
  "change-event",
  "timeline",
  "audit"
] as const;

export type CanonicalConcept = (typeof canonicalConcepts)[number];
