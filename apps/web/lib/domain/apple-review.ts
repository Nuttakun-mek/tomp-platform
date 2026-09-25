import type { Project } from "@tomp/types/domain";

/**
 * True for the demo project kept for Apple's app reviewer. It is a real project
 * doing real work — the reviewer has to be able to drive the whole flow — and it
 * is listed with the others (owner's decision, 2026-09-25) so it can be watched
 * during review; the list and the project itself label it instead of hiding it.
 */
export function isAppleReviewProject(project: Pick<Project, "metadata">): boolean {
  return project.metadata?.appleReview === true;
}
