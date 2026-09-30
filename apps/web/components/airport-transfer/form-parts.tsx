import { FieldHelp } from "@/components/ui/field-help";

// Ground Transfer's field conventions: a red * for required, explanations
// behind a ? tooltip, and only facts the user needs to see (e.g. the airport
// the lookup found) as a visible line under the input.
export function Field({
  label,
  required,
  help,
  note,
  error,
  children
}: {
  label: string;
  required?: boolean;
  help?: string;
  note?: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <label className="field-label">
      <span className="field-title">
        {label}
        {required ? <span className="field-required-badge">*</span> : null}
        {help ? <FieldHelp content={help} /> : null}
      </span>
      {children}
      {note ? <span className="field-hint">{note}</span> : null}
      {error?.length ? <span className="text-[12px] font-semibold text-rose-700">{error[0]}</span> : null}
    </label>
  );
}

export function Section({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="enterprise-panel grid gap-3 p-4">
      <div className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-operation-soft text-[13px] font-bold text-operation">{number}</span>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <FieldHelp content={description} />
      </div>
      {children}
    </section>
  );
}
