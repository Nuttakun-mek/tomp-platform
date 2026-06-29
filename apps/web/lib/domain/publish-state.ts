import type { Project } from "@tomp/types/domain";

export type ProjectEditMode = "draft_edit" | "published_change_request" | "closed_read_only";

export function isProjectPublished(project?: Project | null): boolean {
  return project?.status === "published" || project?.status === "operating" || project?.status === "closing" || project?.status === "closed";
}

export function canEditDirectly(project?: Project | null): boolean {
  return Boolean(project) && !isProjectPublished(project) && project?.status !== "closed" && project?.status !== "archived";
}

export function mustUseChangeRequest(project?: Project | null): boolean {
  return isProjectPublished(project) && project?.status !== "closed";
}

export function getEditMode(project?: Project | null): ProjectEditMode {
  if (!project || project.status === "closed" || project.status === "archived") return "closed_read_only";
  if (mustUseChangeRequest(project)) return "published_change_request";
  return "draft_edit";
}

export function assertCanEditBeforePublish(project?: Project | null): { allowed: boolean; message?: string } {
  if (canEditDirectly(project)) return { allowed: true };
  return {
    allowed: false,
    message: "This project is published. Please submit a change request."
  };
}

