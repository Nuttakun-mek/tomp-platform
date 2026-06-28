import type { Project } from "@tomp/types/domain";
import { demoKernel } from "@/lib/demo/demo-kernel";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { mapProject } from "./mappers";

export async function getProjects(): Promise<Project[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return demoKernel.projects;

  const { data, error } = await supabase.from("projects").select("*").order("start_date", { ascending: true });
  if (error || !data) return demoKernel.projects;
  return data.map(mapProject);
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return demoKernel.projects.find((project) => project.id === projectId) ?? demoKernel.projects[0] ?? null;

  const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (error || !data) return demoKernel.projects.find((project) => project.id === projectId) ?? demoKernel.projects[0] ?? null;
  return mapProject(data);
}
