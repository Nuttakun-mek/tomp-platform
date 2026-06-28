export function DriverQuickActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <button className="rounded-md bg-operation px-4 py-3 text-sm font-semibold text-white" type="button">Confirm ready</button>
      <a className="rounded-md border border-route px-4 py-3 text-center text-sm font-semibold text-route" href="https://www.google.com/maps/dir/?api=1&destination=Demo%20Venue">
        Open Google Maps
      </a>
      <button className="rounded-md border border-amber-300 px-4 py-3 text-sm font-semibold text-amber-800" type="button">Report issue</button>
      <a className="rounded-md border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700" href="tel:+6620000000">Call coordinator</a>
      <a className="rounded-md border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700" href="tel:+6621111111">Call operation</a>
    </div>
  );
}
