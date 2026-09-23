export default function RootLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="grid place-items-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-operation border-t-transparent" />
        <p className="text-sm text-slate-500">กำลังโหลด...</p>
      </div>
    </main>
  );
}
