import { PhoneCall } from "lucide-react";

export function DriverContactStrip() {
  return (
    <section className="sticky bottom-3 z-10 grid gap-3 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-panel backdrop-blur sm:grid-cols-2">
      <a className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700" href="tel:+6620000000">
        <PhoneCall className="h-4 w-4" />
        <span>
          โทรหาผู้ประสานงาน
          <span className="block text-xs font-medium text-slate-500">+66 2 000 0000</span>
        </span>
      </a>
      <a className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-center text-sm font-semibold text-white" href="tel:+6621111111">
        <PhoneCall className="h-4 w-4" />
        <span>
          โทรศูนย์ควบคุม
          <span className="block text-xs font-medium text-slate-200">+66 2 111 1111</span>
        </span>
      </a>
    </section>
  );
}
