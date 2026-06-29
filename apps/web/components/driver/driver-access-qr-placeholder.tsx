interface DriverAccessQrPlaceholderProps {
  accessUrl: string;
}

export function DriverAccessQrPlaceholder({ accessUrl }: DriverAccessQrPlaceholderProps) {
  return (
    <section className="rounded-md border border-dashed border-slate-300 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-operation">Sprint 18 token-ready placeholder</p>
      <h2 className="mt-2 text-lg font-semibold text-ink">Driver QR Access</h2>
      <div className="mt-4 flex aspect-square w-40 items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-center text-sm font-semibold text-slate-600">
        QR placeholder
      </div>
      <p className="mt-4 break-all text-sm text-slate-700">{accessUrl}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">Tokens are generated and hashed server-side. QR image rendering remains a presentation placeholder.</p>
    </section>
  );
}
