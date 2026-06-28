import type { Id, TimelineEvent, TimelineSource } from "./domain";

export interface TimelineEventDraft {
  projectId: Id;
  objectType: string;
  objectId?: Id | null;
  eventType: string;
  actorId?: Id | null;
  source: TimelineSource;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TimelineEventWriter {
  append(event: TimelineEventDraft): Promise<TimelineEvent>;
}
