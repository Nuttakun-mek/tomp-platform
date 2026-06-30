export function TimelineItem({ title, detail, time }: { title: string; detail?: string; time?: string }) {
  return (
    <article className="relative border-l border-slate-200 pl-4">
      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-operation ring-4 ring-teal-50" />
      <p className="font-semibold text-ink">{title}</p>
      {detail ? <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p> : null}
      {time ? <p className="mt-1 text-xs text-slate-500">{time}</p> : null}
    </article>
  );
}
