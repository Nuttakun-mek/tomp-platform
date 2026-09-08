// Driver view — no app shell, no nav. A driver only ever sees their one job.
export default function DriverLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto w-full max-w-xl px-4 py-4 sm:py-6">{children}</div>
    </div>
  );
}
