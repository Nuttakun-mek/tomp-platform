import { CreateAirportTransferCaseForm } from "@/components/airport-transfer/create-case-form";

export default function NewAirportTransferCasePage() {
  return (
    <>
      <header><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">Create Case</p><h1 className="mt-1 text-2xl font-semibold">สร้างการ์ดข้อมูลการเดินทาง</h1><p className="mt-2 text-sm text-slate-500">กรอกข้อมูลผู้โดยสาร เที่ยวบิน จุดรับ–ส่ง รถ และคนขับ ระบบจะสร้างเช็กลิสต์ให้ตามประเภทบริการ</p></header>
      <CreateAirportTransferCaseForm />
    </>
  );
}

