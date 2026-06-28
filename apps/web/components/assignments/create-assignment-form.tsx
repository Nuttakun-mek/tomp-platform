export function CreateAssignmentForm() {
  return (
    <form className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-ink">Create Assignment</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Connect mission, call sign, driver, vehicle, and time window. Database writes are not wired yet.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Mission code" />
        <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Call sign" />
        <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Driver" />
        <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Vehicle" />
        <input className="rounded-md border border-slate-300 px-3 py-2" type="datetime-local" />
        <input className="rounded-md border border-slate-300 px-3 py-2" type="datetime-local" />
      </div>
      <button className="w-fit rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" type="button">
        Save Draft Assignment
      </button>
    </form>
  );
}
