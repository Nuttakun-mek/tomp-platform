import { cache } from "react";
import type { Project } from "@tomp/types/domain";
import { withTimeout } from "@/lib/async/timeout";
import { getPostgresClient } from "@/lib/db/postgres";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { demoOr } from "@/lib/data/demo-fallback";
import { resolveReadClient } from "@/lib/supabase/scoped-client";
import { mapProject } from "./mappers";

// cache(): the shell, the page and workspace tabs all need the project list.
export const getProjects = cache(async function getProjects(): Promise<Project[]> {
  const { client: supabase } = await resolveReadClient();
  if (!supabase) return getProjectsViaPostgres();

  try {
    const { data, error } = await withTimeout(supabase.from("projects").select("*").order("start_date", { ascending: true }), 2200, "projects");
    if (error || !data) return getProjectsViaPostgres();
    return data.map(mapProject);
  } catch {
    return getProjectsViaPostgres();
  }
});

/**
 * True for the demo project kept for Apple's app reviewer.
 *
 * It is a real project doing real work — that is the point, the reviewer has to
 * be able to drive the whole flow — but it is not one of yours, so it has no
 * business in a list you pick from.
 */
export function isAppleReviewProject(project: Project): boolean {
  return project.metadata?.appleReview === true;
}

/**
 * The projects an operator chooses between.
 *
 * Deliberately *not* a filter inside `getProjects()`. Half of that function's
 * callers resolve a project someone already named — mission control finds the
 * one in the URL, the users page needs every project to assign a role against —
 * and hiding a row from them turns "open this project" into a redirect to
 * nowhere. Listing and resolving are different questions, so they get different
 * functions, and each call site says which one it is asking.
 */
export async function getVisibleProjects(): Promise<Project[]> {
  return (await getProjects()).filter((project) => !isAppleReviewProject(project));
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  const { client: supabase } = await resolveReadClient();
  if (!supabase) return getProjectByIdViaPostgres(projectId);

  try {
    const { data, error } = await withTimeout(supabase.from("projects").select("*").eq("id", projectId).maybeSingle(), 2200, "project detail");
    if (error || !data) return getProjectByIdViaPostgres(projectId);
    return mapProject(data);
  } catch {
    return getProjectByIdViaPostgres(projectId);
  }
}

async function getProjectsViaPostgres(): Promise<Project[]> {
  const sql = getPostgresClient();
  if (!sql) return demoOr(demoKernel.projects, []);
  try {
    const data = await sql<Array<Record<string, unknown>>>`select * from projects order by start_date asc, created_at desc limit 100`;
    return data.length ? data.map(mapProject) : demoOr(demoKernel.projects, []);
  } catch {
    return demoOr(demoKernel.projects, []);
  }
}

// cache(): the project layout, the Ground Transfer layout and the page all
// resolve the same code on one request. Layouts render before their children,
// so uncached that was three database round trips in a row on every page.
export const getProjectByCode = cache(async function getProjectByCode(projectCode: string): Promise<Project | null> {
  const { client: supabase } = await resolveReadClient();
  if (!supabase) return getProjectByCodeViaPostgres(projectCode);

  try {
    const { data, error } = await withTimeout(supabase.from("projects").select("*").eq("project_code", projectCode).maybeSingle(), 2200, "project detail by code");
    if (error || !data) return getProjectByCodeViaPostgres(projectCode);
    return mapProject(data);
  } catch {
    return getProjectByCodeViaPostgres(projectCode);
  }
});

async function getProjectByCodeViaPostgres(projectCode: string): Promise<Project | null> {
  const sql = getPostgresClient();
  if (!sql) return demoOr(demoKernel.projects.find((project) => project.projectCode === projectCode) ?? null, null);
  try {
    const data = await sql<Array<Record<string, unknown>>>`select * from projects where project_code = ${projectCode} limit 1`;
    if (data[0]) return mapProject(data[0]);
    return demoOr(demoKernel.projects.find((project) => project.projectCode === projectCode) ?? null, null);
  } catch {
    return demoOr(demoKernel.projects.find((project) => project.projectCode === projectCode) ?? null, null);
  }
}

async function getProjectByIdViaPostgres(projectId: string): Promise<Project | null> {
  const sql = getPostgresClient();
  // Only ever return a demo project when its id actually matches the request.
  // Falling back to demoKernel.projects[0] would render a different project's
  // data under the requested project's URL.
  if (!sql) return demoOr(demoKernel.projects.find((project) => project.id === projectId) ?? null, null);
  try {
    const data = await sql<Array<Record<string, unknown>>>`select * from projects where id = ${projectId} limit 1`;
    if (data[0]) return mapProject(data[0]);
    return demoOr(demoKernel.projects.find((project) => project.id === projectId) ?? null, null);
  } catch {
    return demoOr(demoKernel.projects.find((project) => project.id === projectId) ?? null, null);
  }
}
