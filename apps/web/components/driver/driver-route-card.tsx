export function DriverRouteCard({ pickup, dropoff, commitmentTime, summary }: { pickup: string; dropoff: string; commitmentTime: string; summary: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <p className="text-sm font-semibold text-operation">จุดรับ / จุดส่ง / เวลา</p>
      <p className="mt-1 text-sm text-slate-600">{summary}</p>
      <div className="mt-4 grid gap-3">
        <RoutePoint label="จุดรับ" value={pickup} tone="bg-blue-600" />
        <RoutePoint label="จุดส่ง" value={dropoff} tone="bg-operation" />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-800">เวลาที่ต้องถึง</p>
          <p className="mt-1 text-lg font-semibold text-amber-950">{commitmentTime}</p>
        </div>
      </div>
    </section>
  );
}

function RoutePoint({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <span className={`mt-1 h-3 w-3 rounded-full ${tone}`} />
      <div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}
