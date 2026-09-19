"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Building2, MapPin, PlaneLanding, PlaneTakeoff } from "lucide-react";
import { updateAirportTransferCase, type UpdateTransferCaseState } from "@/app/airport-transfer/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { DateTimeField } from "@/components/ui/datetime-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AirportTransferCase } from "@/lib/airport-transfer/types";

const initialState: UpdateTransferCaseState = { ok: false, message: "" };
const ignoredDirtyFields = new Set(["caseId", "originalUpdatedAt", "editReason"]);

function serializeEditableFields(form: HTMLFormElement) {
  return JSON.stringify(Array.from(new FormData(form).entries())
    .filter(([name]) => !ignoredDirtyFields.has(name))
    .map(([name, value]) => [name, String(value)])
    .sort(([left], [right]) => left.localeCompare(right)));
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string[]; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>{label}</span>{children}{hint ? <span className="text-xs font-normal text-slate-500">{hint}</span> : null}{error?.[0] ? <span className="text-xs font-normal text-red-700">{error[0]}</span> : null}</label>;
}

function Section({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:p-5"><div className="mb-4 flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-100 text-sm font-bold text-cyan-900">{number}</span><div><h2 className="text-lg font-semibold text-slate-950">{title}</h2><p className="mt-0.5 text-sm text-slate-500">{description}</p></div></div>{children}</section>;
}

function toBangkokDateTimeLocal(value: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function EditAirportTransferCaseForm({ item, projectCode }: { item: AirportTransferCase; projectCode: string }) {
  const [state, formAction, pending] = useActionState(updateAirportTransferCase, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const baselineRef = useRef("");
  const [dirty, setDirty] = useState(false);
  const [direction, setDirection] = useState(item.direction);
  const [travelDate, setTravelDate] = useState(item.travelDate);
  const [departureTime, setDepartureTime] = useState(toBangkokDateTimeLocal(item.scheduledDepartureAt));
  const [arrivalTime, setArrivalTime] = useState(toBangkokDateTimeLocal(item.scheduledArrivalAt));
  const [pickupTime, setPickupTime] = useState(toBangkokDateTimeLocal(item.confirmedPickupAt));
  const errors = state.fieldErrors || {};

  useEffect(() => {
    if (formRef.current) baselineRef.current = serializeEditableFields(formRef.current);
  }, []);

  useEffect(() => {
    if (!baselineRef.current) return;
    const frame = window.requestAnimationFrame(() => detectChanges());
    return () => window.cancelAnimationFrame(frame);
  }, [direction, travelDate, departureTime, arrivalTime, pickupTime]);

  function detectChanges() {
    if (formRef.current) setDirty(serializeEditableFields(formRef.current) !== baselineRef.current);
  }

  function markControlledChange(update: () => void) {
    update();
  }

  return (
    <form ref={formRef} action={formAction} onChange={detectChanges} className="grid gap-4">
      <input type="hidden" name="caseId" value={item.id} />
      <input type="hidden" name="originalUpdatedAt" value={item.updatedAt} />

      <Section number="1" title="ประเภทบริการ" description="รูปแบบเดียวกับหน้าสร้างการ์ด เพื่อค้นหาและแก้ไขข้อมูลได้เร็ว">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,1fr)]">
          <fieldset><legend className="mb-1.5 text-sm font-semibold text-slate-700">ประเภทบริการ</legend><div className="grid gap-2 sm:grid-cols-2">
            {([
              { value: "arrival", title: "รับเข้าจากสนามบิน", detail: "สนามบิน → ที่พัก", icon: PlaneLanding },
              { value: "departure", title: "ส่งออกไปสนามบิน", detail: "ที่พัก → สนามบิน", icon: PlaneTakeoff }
            ] as const).map(({ value, title, detail, icon: Icon }) => <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${direction === value ? "border-cyan-700 bg-cyan-50 text-cyan-950 ring-2 ring-cyan-100" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}><input type="radio" name="direction" value={value} checked={direction === value} onChange={() => markControlledChange(() => setDirection(value))} className="sr-only" /><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${direction === value ? "bg-cyan-700 text-white" : "bg-slate-100 text-slate-500"}`}><Icon className="h-5 w-5" /></span><span><span className="block text-sm font-bold">{title}</span><span className="block text-xs text-slate-500">{detail}</span></span></label>)}
          </div></fieldset>
          <Field label="ชื่อลูกค้า/บริษัท"><Input name="clientName" defaultValue={item.clientName || ""} /></Field>
        </div>
      </Section>

      <Section number="2" title="ข้อมูลผู้โดยสาร" description="แก้ไขเฉพาะข้อมูลที่เปลี่ยนแปลง ระบบจะเก็บค่าเดิมและค่าใหม่ในประวัติ">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label="คำนำหน้า"><Select name="passengerTitle" defaultValue={item.passengerTitle || ""}><option value="">ไม่ระบุ</option><option>Mr.</option><option>Mrs.</option><option>Ms.</option><option>Dr.</option></Select></Field>
          <Field label="ชื่อ *" error={errors.passengerFirstName}><Input name="passengerFirstName" required defaultValue={item.passengerFirstName} /></Field>
          <Field label="นามสกุล *" error={errors.passengerLastName}><Input name="passengerLastName" required defaultValue={item.passengerLastName} /></Field>
          <Field label="เบอร์โทรศัพท์"><Input name="passengerMobile" inputMode="tel" defaultValue={item.passengerMobile || ""} /></Field>
          <Field label="อีเมล" error={errors.passengerEmail}><Input name="passengerEmail" type="email" defaultValue={item.passengerEmail || ""} /></Field>
          <Field label="จำนวนผู้โดยสาร"><Input name="passengerCount" type="number" min="1" defaultValue={item.passengerCount} /></Field>
          <Field label="จำนวนกระเป๋า"><Input name="luggageCount" type="number" min="0" defaultValue={item.luggageCount} /></Field>
          <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"><input name="fastTrack" type="checkbox" defaultChecked={item.fastTrack} /> Fast Track</label>
        </div>
      </Section>

      <Section number="3" title="เที่ยวบิน" description="เมื่อบันทึก ระบบจะตรวจและอัปเดตข้อมูลเที่ยวบินจาก API ให้อัตโนมัติ">
        <div className="grid gap-4">
          <div className="grid items-start gap-3 md:grid-cols-2">
            <div><DateTimeField label="วันเดินทาง" name="travelDate" required value={travelDate} onChange={(value) => markControlledChange(() => setTravelDate(value))} />{errors.travelDate?.[0] ? <p className="text-xs text-red-700">{errors.travelDate[0]}</p> : null}</div>
            <Field label="หมายเลขเที่ยวบิน *" error={errors.flightNumber}><Input name="flightNumber" required defaultValue={item.flightNumber} /></Field>
          </div>
          <div className="grid items-stretch gap-2 lg:grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3"><div className="mb-3 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-100 text-cyan-800"><PlaneTakeoff className="h-4 w-4" /></span><div><p className="text-sm font-bold">สนามบินต้นทาง</p><p className="text-xs text-slate-500">Departure</p></div></div><div className="grid gap-3 sm:grid-cols-2"><Field label="สนามบิน"><Input name="originAirport" maxLength={3} defaultValue={item.originAirport || ""} /></Field><DateTimeField label="เวลาออก" name="scheduledDepartureLocal" withTime value={departureTime} onChange={(value) => markControlledChange(() => setDepartureTime(value))} /></div></div>
            <div className="grid place-items-center text-slate-300"><ArrowRight className="hidden h-5 w-5 lg:block" /><ArrowDown className="h-5 w-5 lg:hidden" /></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3"><div className="mb-3 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-100 text-blue-800"><PlaneLanding className="h-4 w-4" /></span><div><p className="text-sm font-bold">สนามบินปลายทาง</p><p className="text-xs text-slate-500">Arrival</p></div></div><div className="grid gap-3 sm:grid-cols-2"><Field label="สนามบิน"><Input name="destinationAirport" maxLength={3} defaultValue={item.destinationAirport || ""} /></Field><DateTimeField label="เวลาถึง" name="scheduledArrivalLocal" withTime value={arrivalTime} onChange={(value) => markControlledChange(() => setArrivalTime(value))} /></div></div>
          </div>
        </div>
      </Section>

      <Section number="4" title="จุดรับ จุดส่ง และเวลา" description="จัดกลุ่มข้อมูลตามจุดปฏิบัติงาน ลดการแก้ไขผิดช่อง">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50/40 p-3"><div className="mb-3 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-700 text-white"><MapPin className="h-4 w-4" /></span><div><p className="text-sm font-bold">จุดรับผู้โดยสาร</p><p className="text-xs text-slate-500">Pickup location</p></div></div><div className="grid gap-3"><Field label="ชื่อจุดรับ *" error={errors.pickupName}><Input name="pickupName" required defaultValue={item.pickupName} /></Field><Field label="ที่อยู่จุดรับ"><Input name="pickupAddress" defaultValue={item.pickupAddress || ""} /></Field><Field label="Google Maps จุดรับ"><Input name="pickupMapsUrl" type="url" defaultValue={item.pickupMapsUrl || ""} /></Field></div></div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-3"><div className="mb-3 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-700 text-white"><Building2 className="h-4 w-4" /></span><div><p className="text-sm font-bold">จุดส่งผู้โดยสาร</p><p className="text-xs text-slate-500">Drop-off location</p></div></div><div className="grid gap-3"><Field label="ชื่อจุดส่ง *" error={errors.dropoffName}><Input name="dropoffName" required defaultValue={item.dropoffName} /></Field><Field label="ที่อยู่จุดส่ง"><Input name="dropoffAddress" defaultValue={item.dropoffAddress || ""} /></Field><Field label="Google Maps จุดส่ง"><Input name="dropoffMapsUrl" type="url" defaultValue={item.dropoffMapsUrl || ""} /></Field></div></div>
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 lg:col-span-2 md:grid-cols-2"><DateTimeField label="เวลารับที่ยืนยัน" name="confirmedPickupLocal" withTime value={pickupTime} onChange={(value) => markControlledChange(() => setPickupTime(value))} /><Field label="เหตุผลที่ปรับเวลารับ"><Input name="pickupTimeOverrideReason" defaultValue={item.pickupTimeOverrideReason || ""} /></Field></div>
        </div>
      </Section>

      <Section number="5" title="รถและคนขับ" description="ข้อมูลสำหรับการประสานงานและปฏิบัติการ">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label="ประเภทรถ"><Select name="vehicleType" defaultValue={item.vehicleType || ""}><option value="">ยังไม่กำหนด</option><option value="sedan">Sedan</option><option value="executive_sedan">Executive Sedan</option><option value="van">Van</option><option value="luxury_van">Luxury Van</option></Select></Field>
          <Field label="ทะเบียนรถ"><Input name="vehiclePlate" defaultValue={item.vehiclePlate || ""} /></Field>
          <Field label="ชื่อคนขับ"><Input name="driverName" defaultValue={item.driverName || ""} /></Field>
          <Field label="เบอร์โทรคนขับ"><Input name="driverPhone" inputMode="tel" defaultValue={item.driverPhone || ""} /></Field>
        </div>
      </Section>

      <Section number="6" title="หมายเหตุและเหตุผลการแก้ไข" description="เหตุผลช่วยให้ตรวจสอบประวัติและติดตามการเปลี่ยนแปลงได้ง่าย">
        <div className="grid gap-3 md:grid-cols-2"><Field label="หมายเหตุ"><Textarea name="notes" rows={4} defaultValue={item.notes || ""} /></Field><Field label="เหตุผลในการแก้ไข" hint="ไม่ใช้เป็นตัวเปิดปุ่มบันทึก ต้องมีข้อมูลหลักเปลี่ยนแปลง"><Textarea name="editReason" rows={4} placeholder="เช่น ลูกค้าแจ้งเปลี่ยนโรงแรม หรือเปลี่ยนเที่ยวบิน" /></Field></div>
      </Section>

      {state.message ? <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{state.message}</div> : null}
      <div className="flex flex-col items-end gap-1"><div className="flex justify-end gap-2"><ButtonLink href={`/projects/${projectCode}/airport-transfer/cases/${item.id}`} variant="secondary">ยกเลิก</ButtonLink><Button type="submit" disabled={pending || !dirty}>{pending ? "กำลังบันทึก..." : dirty ? "บันทึกการแก้ไข" : "ยังไม่มีข้อมูลเปลี่ยนแปลง"}</Button></div>{!dirty ? <p className="text-xs text-slate-500">ปุ่มบันทึกจะเปิดเมื่อมีข้อมูลเปลี่ยนแปลง</p> : null}</div>
    </form>
  );
}
