export function DriverContactStrip() {
  return (
    <section className="sticky bottom-3 z-10 grid gap-3 rounded-md border border-slate-200 bg-white/95 p-4 shadow-panel backdrop-blur sm:grid-cols-2">
      <a className="min-h-12 rounded-md border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700" href="tel:+6620000000">
        โทรหาผู้ประสานงาน
        <span className="block text-xs font-medium text-slate-500">+66 2 000 0000</span>
      </a>
      <a className="min-h-12 rounded-md bg-ink px-4 py-3 text-center text-sm font-semibold text-white" href="tel:+6621111111">
        โทรศูนย์ควบคุม
        <span className="block text-xs font-medium text-slate-200">+66 2 111 1111</span>
      </a>
    </section>
  );
}
