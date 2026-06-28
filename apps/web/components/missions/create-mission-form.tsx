export function CreateMissionForm() {
  return (
    <form className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-ink">Create Mission</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Mission is a service activity. Submission will be wired after project persistence exists.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Mission code
          <input className="rounded-md border border-slate-300 px-3 py-2" name="missionCode" placeholder="MIS-001" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Mission name
          <input className="rounded-md border border-slate-300 px-3 py-2" name="missionName" placeholder="Airport pickup wave 1" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Mission type
          <input className="rounded-md border border-slate-300 px-3 py-2" name="missionType" placeholder="Airport Pickup" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Priority
          <select className="rounded-md border border-slate-300 px-3 py-2" name="priority" defaultValue="normal">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Planned start
          <input className="rounded-md border border-slate-300 px-3 py-2" name="plannedStartTime" type="datetime-local" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Planned end
          <input className="rounded-md border border-slate-300 px-3 py-2" name="plannedEndTime" type="datetime-local" />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Service commitment
        <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-2" name="serviceCommitment" placeholder="Pickup target, location, service level, success criteria" />
      </label>
      <button className="w-fit rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" type="button">
        Save Draft Mission
      </button>
    </form>
  );
}
