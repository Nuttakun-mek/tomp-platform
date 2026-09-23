export default function AppLoading() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="grid place-items-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-operation border-t-transparent" />
        <p className="text-sm text-slate-500">กำลังโหลด...</p>
      </div>
    </div>
  );
}
