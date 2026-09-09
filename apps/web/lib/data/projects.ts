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
