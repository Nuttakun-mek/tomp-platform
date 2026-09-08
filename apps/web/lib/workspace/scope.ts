export const SCOPE_COOKIE = "tomp_scope";

export interface ScopeProject {
  id: string;
  projectCode: string;
  projectName: string;
  status?: string;
}

// Resolves which project is the active scope: the cookie's project if it is still
// in the viewer's visible list, otherwise the first visible project, otherwise null.
export function resolveActiveScope<T extends ScopeProject>(projects: T[], cookieValue?: string | null): T | null {
  if (!projects.length) return null;
  if (cookieValue) {
    const matched = projects.find((project) => project.id === cookieValue);
    if (matched) return matched;
  }
  return projects[0];
}
