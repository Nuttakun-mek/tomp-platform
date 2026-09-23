// The average hourly rate the typed amount and hours work out to, shown as a
// read-only field so it lines up with the inputs beside it.
export function HourlyRatePreview({ rate }: { rate: number | null }) {
  return (
    <div className="field-label">
      อัตราเฉลี่ย
      <output className="field-input flex items-center whitespace-nowrap border-transparent bg-operation-soft font-bold text-operation">
        {rate != null ? `${rate.toLocaleString("th-TH")} บ./ชม.` : "—"}
      </output>
    </div>
  );
}
