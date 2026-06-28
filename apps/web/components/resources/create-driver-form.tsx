export function CreateDriverForm() {
  return (
    <form className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Create Driver</h2>
      <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Full name" />
      <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Phone" />
      <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="License type" />
      <button className="w-fit rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" type="button">Save Draft Driver</button>
    </form>
  );
}
