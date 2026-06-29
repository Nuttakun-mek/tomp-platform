"use client";

import { useState } from "react";
import { publishProjectAction } from "@/app/actions/publish";

export function PublishActionCard({ projectId, canPublish }: { projectId: string; canPublish: boolean }) {
  const [message, setMessage] = useState<string | null>(null);

  async function publish() {
    const result = await publishProjectAction({
      projectId,
      reason: "Baseline published from Sprint 11 publish action.",
      snapshotData: { projectId, source: "project_detail_publish_card" }
    });

    setMessage(result.success ? result.warning || "Publish snapshot created." : result.error || "Publish failed.");
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Publish Baseline</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Publishing records a baseline snapshot. Later changes must be captured as change requests and timeline events.</p>
      {message ? <p className="mt-3 text-sm font-medium text-slate-700">{message}</p> : null}
      <button
        className="mt-4 rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled={!canPublish}
        onClick={publish}
        type="button"
      >
        Publish Baseline
      </button>
    </section>
  );
}

