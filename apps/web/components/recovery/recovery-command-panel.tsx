import { mapRecoveryActionToThai } from "@/lib/domain/recovery-rules";

const recoveryScenarios = [
  { title: "GPS หาย", detail: "ตรวจสัญญาณล่าสุด โทรคนขับ และติดตามอีกครั้งใน 5 นาที", actions: ["contact_driver", "monitor"] as const },
  { title: "รถมีปัญหา", detail: "ประเมินผลกระทบต่อ Assignment และเตรียมรถสำรอง", actions: ["replace_vehicle", "notify_organizer"] as const },
  { title: "คนขับไม่ตอบ", detail: "โทรซ้ำ ติดต่อผู้ประสานงาน และยกระดับหากเกินเวลาที่กำหนด", actions: ["contact_driver", "contact_coordinator"] as const }
];

export function RecoveryCommandPanel() {
  return (
    <section className="enterprise-card p-5 lg:p-6">
      <p className="text-sm font-semibold text-operation">Recovery Playbook</p>
      <h2 className="mt-1 text-2xl font-semibold text-ink">แนวทางกู้คืนสถานการณ์</h2>
      <div className="mt-5 grid gap-3">
        {recoveryScenarios.map((scenario) => (
          <article key={scenario.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-ink">{scenario.title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">{scenario.detail}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {scenario.actions.map((action) => (
                <span key={action} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{mapRecoveryActionToThai(action)}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
