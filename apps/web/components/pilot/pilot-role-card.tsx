export function PilotRoleCard({ role, responsibility }: { role: string; responsibility: string }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
      <p className="font-semibold text-ink">{role}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{responsibility}</p>
    </article>
  );
}
