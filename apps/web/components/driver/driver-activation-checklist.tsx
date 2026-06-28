const checklist = ["Confirm name", "Confirm phone", "Confirm vehicle", "Vehicle photo", "Plate photo"];

export function DriverActivationChecklist() {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Activation Checklist</h2>
      <div className="mt-4 grid gap-3">
        {checklist.map((item) => (
          <label key={item} className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <input type="checkbox" className="h-4 w-4" />
            {item}
          </label>
        ))}
      </div>
    </section>
  );
}
