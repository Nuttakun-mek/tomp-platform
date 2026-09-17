export default function AirportTransferSettingsPage() {
  const rules = [
    ["ส่งออก: ถึงสนามบินก่อนเที่ยวบิน", "180 นาที"],
    ["รับเข้า: Immigration/Baggage Buffer", "45 นาที"],
    ["Safety Buffer การเดินทาง", "20 นาที"],
    ["ตรวจเที่ยวบินซ้ำก่อนเดินทาง", "72 / 24 / 6 ชั่วโมง"],
    ["เก็บ Flight API Raw Payload", "30 วัน"]
  ];
  return (
    <>
      <header><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">Operation Rules</p><h1 className="mt-1 text-2xl font-semibold">ตั้งค่าระบบ Airport Transfer</h1><p className="mt-2 text-sm text-slate-500">ระยะแรกแสดงค่ามาตรฐาน ระบบแก้ไขและอนุมัติกฎจะเพิ่มหลังจบ Workflow หลัก</p></header>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="grid grid-cols-[minmax(0,1fr)_180px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500"><span>กฎปฏิบัติการ</span><span>ค่าปัจจุบัน</span></div>{rules.map(([label, value]) => <div key={label} className="grid grid-cols-[minmax(0,1fr)_180px] border-b border-slate-100 px-4 py-3 text-sm last:border-0"><span className="font-medium">{label}</span><span className="text-slate-500">{value}</span></div>)}</section>
    </>
  );
}

