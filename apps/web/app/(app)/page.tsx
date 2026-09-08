import { redirect } from "next/navigation";

// The app is project-centric: pick a project first.
export default function RootPage() {
  redirect("/projects");
}
