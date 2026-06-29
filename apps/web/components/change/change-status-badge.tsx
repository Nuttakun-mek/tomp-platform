const toneByStatus: Record<string, string> = {
  requested: "border-amber-200 bg-amber-50 text-amber-800",
  approved: "border-blue-200 bg-blue-50 text-blue-800",
  applied: "border-teal-200 bg-teal-50 text-teal-800",
  rejected: "border-red-200 bg-red-50 text-red-800"
};

export function ChangeStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    requested: "รอพิจารณา",
    approved: "อนุมัติแล้ว",
    applied: "นำไปใช้แล้ว",
    rejected: "ปฏิเสธ"
  };
  return <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${toneByStatus[status] || "border-slate-200 bg-slate-50 text-slate-700"}`}>{labels[status] ?? status}</span>;
}
