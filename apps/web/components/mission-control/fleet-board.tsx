import type { Assignment, DriverLocation } from "@tomp/types/domain";

export function FleetBoard({ assignments, locations }: { assignments: Assignment[]; locations: DriverLocation[] }) {
  return (
    <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <div>
        <h2 className="text-lg font-semibold text-ink">สถานะรถและคนขับ</h2>
        <p className="mt-1 text-sm text-slate-600">แสดง Assignment จริงและตำแหน่งล่าสุดที่คนขับส่งเข้าระบบ</p>
      </div>
      {assignments.length ? (
        <div className="grid gap-3">
          {assignments.map((assignment) => {
            const location = locations.find((item) => item.assignmentId === assignment.id);
            return (
              <article key={assignment.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">Assignment {assignment.id.slice(0, 8)}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {location ? "มีตำแหน่งล่าสุด" : "รอตำแหน่ง"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Driver: {assignment.driverId ? assignment.driverId.slice(0, 8) : "ยังไม่ระบุ"} | Vehicle:{" "}
                  {assignment.vehicleId ? assignment.vehicleId.slice(0, 8) : "ยังไม่ระบุ"}
                </p>
                {location ? <p className="mt-1 text-xs text-slate-500">ล่าสุด {new Date(location.recordedAt).toLocaleString("th-TH")}</p> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">ยังไม่มี Assignment ในโครงการนี้</p>
      )}
    </section>
  );
}
