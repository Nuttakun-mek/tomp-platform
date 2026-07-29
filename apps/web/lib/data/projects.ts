import type { Project } from "@tomp/types/domain";
import { getPostgresClient } from "@/lib/db/postgres";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { getSupabaseServerDataClient } from "@/lib/supabase/server";
import { mapProject } from "./mappers";

export async function getProjects(): Promise<Project[]> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return getProjectsViaPostgres();

  const { data, error } = await supabase.from("projects").select("*").order("start_date", { ascending: true });
  if (error || !data) return getProjectsViaPostgres();
  return data.map(mapProject);
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  const supabase = getSupabaseServerDataClient();
  if (!supabase) return getProjectByIdViaPostgres(projectId);

  const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (error || !data) return getProjectByIdViaPostgres(projectId);
  return mapProject(data);
}

async function getProjectsViaPostgres(): Promise<Project[]> {
  const sql = getPostgresClient();
  if (!sql) return demoKernel.projects;
  const data = await sql<Array<Record<string, unknown>>>`select * from projects order by start_date asc, created_at desc limit 100`;
  return data.length ? data.map(mapProject) : demoKernel.projects;
}

async function getProjectByIdViaPostgres(projectId: string): Promise<Project | null> {
  const sql = getPostgresClient();
  if (!sql) return demoKernel.projects.find((project) => project.id === projectId) ?? demoKernel.projects[0] ?? null;
  const data = await sql<Array<Record<string, unknown>>>`select * from projects where id = ${projectId} limit 1`;
  if (data[0]) return mapProject(data[0]);
  return demoKernel.projects.find((project) => project.id === projectId) ?? demoKernel.projects[0] ?? null;
}
