import type { Project } from "@tomp/types/domain";
import { getEditMode } from "@/lib/domain/publish-state";

export function PublishedLockBanner({ project }: { project?: Project | null }) {
  const mode = getEditMode(project);

  if (mode === "draft_edit") {
    return (
      <section className="mb-6 rounded-md border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
        Draft planning mode is active. Direct edits are allowed until the project is published.
      </section>
    );
  }

  if (mode === "published_change_request") {
    return (
      <section className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        This project is published and locked. Operational changes must go through a change request and timeline event.
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      This project is read-only.
    </section>
  );
}

