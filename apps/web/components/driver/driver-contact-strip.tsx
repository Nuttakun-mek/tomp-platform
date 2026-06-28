export function DriverContactStrip() {
  return (
    <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-2">
      <a className="rounded-md border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700" href="tel:+6620000000">
        Call coordinator: +66 2 000 0000
      </a>
      <a className="rounded-md border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700" href="tel:+6621111111">
        Call operation: +66 2 111 1111
      </a>
    </div>
  );
}
