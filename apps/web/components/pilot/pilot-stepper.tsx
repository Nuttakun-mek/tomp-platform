import Link from "next/link";

export interface PilotStep {
  title: string;
  detail: string;
  href: string;
}

export function PilotStepper({ steps }: { steps: PilotStep[] }) {
  return (
    <section className="grid gap-3">
      {steps.map((step, index) => (
        <Link key={step.title} href={step.href} className="rounded-md border border-slate-200 bg-white p-4 shadow-soft transition hover:border-operation hover:bg-teal-50">
          <div className="flex gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-operation text-sm font-semibold text-white">{index + 1}</span>
            <div>
              <h2 className="font-semibold text-ink">{step.title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">{step.detail}</p>
            </div>
          </div>
        </Link>
      ))}
    </section>
  );
}
