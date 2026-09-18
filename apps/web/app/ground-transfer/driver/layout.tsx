// Driver view — no app shell, no nav. A driver only ever sees their one job.
// This screen is also the basis for the mobile app webview, so it must stay a
// single narrow column that works from ~320px up and respects device safe areas.
export default function DriverLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className="min-h-[100svh] bg-canvas text-ink"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)"
      }}
    >
      <div className="mx-auto w-full max-w-[520px] px-3 py-4 sm:px-4">{children}</div>
    </div>
  );
}
