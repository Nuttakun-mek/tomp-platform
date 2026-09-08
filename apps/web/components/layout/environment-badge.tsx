// Shows only outside production so real users never see a "test/internal" chip.
export function EnvironmentBadge() {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV;
  if (env === "production") return null;

  const label = env === "preview" ? "พรีวิว" : "โหมดพัฒนา";
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold text-amber-200">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
      {label}
    </span>
  );
}
