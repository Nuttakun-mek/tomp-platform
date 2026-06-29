export function LoadingState({ label = "Loading" }: { label?: string }) {
  return <div className="rounded-md border border-slate-200 bg-white p-5 text-sm font-medium text-slate-600">{label}...</div>;
}

