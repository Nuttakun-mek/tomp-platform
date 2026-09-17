"use client";

import { useActionState } from "react";
import { updateAirportTransferCase, type UpdateTransferCaseState } from "@/app/airport-transfer/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AirportTransferCase } from "@/lib/airport-transfer/types";

const initialState: UpdateTransferCaseState = { ok: false, message: "" };

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string[]; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-slate-700"><span>{label}</span>{children}{hint ? <span className="text-xs font-normal text-slate-500">{hint}</span> : null}{error?.[0] ? <span className="text-xs font-normal text-red-700">{error[0]}</span> : null}</label>;
}

function toBangkokDateTimeLocal(value: string | null) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function EditAirportTransferCaseForm({ item }: { item: AirportTransferCase }) {
  const [state, formAction, pending] = useActionState(updateAirportTransferCase, initialState);
  const errors = state.fieldErrors || {};
  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="caseId" value={item.id} />
      <input type="hidden" name="originalUpdatedAt" value={item.updatedAt} />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">ข้อมูลผู้โดยสารและบริการ</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label="ประเภทบริการ"><Select name="direction" defaultValue={item.direction}><option value="arrival">รับเข้าจากสนามบิน → ที่พัก</option><option value="departure">ส่งออกจากที่พัก → สนามบิน</option></Select></Field>
          <Field label="ลูกค้า/บริษัท"><Input name="clientName" defaultValue={item.clientName || ""} /></Field>
          <Field label="คำนำหน้า"><Select name="passengerTitle" defaultValue={item.passengerTitle || ""}><option value="">ไม่ระบุ</option><option>Mr.</option><option>Mrs.</option><option>Ms.</option><option>Dr.</option></Select></Field>
          <div />
          <Field label="ชื่อ *" error={errors.passengerFirstName}><Input name="passengerFirstName" required defaultValue={item.passengerFirstName} /></Field>
          <Field label="นามสกุล *" error={errors.passengerLastName}><Input name="passengerLastName" required defaultValue={item.passengerLastName} /></Field>
          <Field label="อีเมล" error={errors.passengerEmail}><Input name="passengerEmail" type="email" defaultValue={item.passengerEmail || ""} /></Field>
          <Field label="เบอร์โทรศัพท์"><Input name="passengerMobile" defaultValue={item.passengerMobile || ""} /></Field>
          <Field label="จำนวนผู้โดยสาร"><Input name="passengerCount" type="number" min="1" defaultValue={item.passengerCount} /></Field>
          <Field label="จำนวนกระเป๋า"><Input name="luggageCount" type="number" min="0" defaultValue={item.luggageCount} /></Field>
          <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"><input name="fastTrack" type="checkbox" defaultChecked={item.fastTrack} /> Fast Track</label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">เที่ยวบินและเวลา</h2>
        <p className="mt-1 text-xs text-slate-500">หากเปลี่ยนวัน เที่ยวบิน เส้นทาง หรือเวลา ระบบจะกำหนดสถานะเป็น “ต้องตรวจสอบใหม่”</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label="วันเดินทาง *" error={errors.travelDate}><Input name="travelDate" type="date" required defaultValue={item.travelDate} /></Field>
          <Field label="หมายเลขเที่ยวบิน *" error={errors.flightNumber}><Input name="flightNumber" required defaultValue={item.flightNumber} /></Field>
          <Field label="สนามบินต้นทาง"><Input name="originAirport" maxLength={3} defaultValue={item.originAirport || ""} /></Field>
          <Field label="สนามบินปลายทาง"><Input name="destinationAirport" maxLength={3} defaultValue={item.destinationAirport || ""} /></Field>
          <Field label="เวลาออก" hint="เวลาไทยเมื่อแก้ไขด้วยตนเอง"><Input name="scheduledDepartureLocal" type="datetime-local" defaultValue={toBangkokDateTimeLocal(item.scheduledDepartureAt)} /></Field>
          <Field label="เวลาถึง" hint="เวลาไทยเมื่อแก้ไขด้วยตนเอง"><Input name="scheduledArrivalLocal" type="datetime-local" defaultValue={toBangkokDateTimeLocal(item.scheduledArrivalAt)} /></Field>
          <Field label="เวลารับที่ยืนยัน"><Input name="confirmedPickupLocal" type="datetime-local" defaultValue={toBangkokDateTimeLocal(item.confirmedPickupAt)} /></Field>
          <Field label="เหตุผลที่ปรับเวลารับ"><Input name="pickupTimeOverrideReason" defaultValue={item.pickupTimeOverrideReason || ""} /></Field>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">จุดรับ–ส่ง รถ และคนขับ</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label="ชื่อจุดรับ *" error={errors.pickupName}><Input name="pickupName" required defaultValue={item.pickupName} /></Field>
          <Field label="ที่อยู่จุดรับ"><Input name="pickupAddress" defaultValue={item.pickupAddress || ""} /></Field>
          <Field label="Google Maps จุดรับ"><Input name="pickupMapsUrl" type="url" defaultValue={item.pickupMapsUrl || ""} /></Field>
          <div />
          <Field label="ชื่อจุดส่ง *" error={errors.dropoffName}><Input name="dropoffName" required defaultValue={item.dropoffName} /></Field>
          <Field label="ที่อยู่จุดส่ง"><Input name="dropoffAddress" defaultValue={item.dropoffAddress || ""} /></Field>
          <Field label="Google Maps จุดส่ง"><Input name="dropoffMapsUrl" type="url" defaultValue={item.dropoffMapsUrl || ""} /></Field>
          <div />
          <Field label="ประเภทรถ"><Select name="vehicleType" defaultValue={item.vehicleType || ""}><option value="">ยังไม่กำหนด</option><option value="sedan">Sedan</option><option value="executive_sedan">Executive Sedan</option><option value="van">Van</option><option value="luxury_van">Luxury Van</option></Select></Field>
          <Field label="ทะเบียนรถ"><Input name="vehiclePlate" defaultValue={item.vehiclePlate || ""} /></Field>
          <Field label="ชื่อคนขับ"><Input name="driverName" defaultValue={item.driverName || ""} /></Field>
          <Field label="เบอร์โทรคนขับ"><Input name="driverPhone" defaultValue={item.driverPhone || ""} /></Field>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="หมายเหตุ"><Textarea name="notes" rows={4} defaultValue={item.notes || ""} /></Field>
          <Field label="เหตุผลในการแก้ไข" hint="จะแสดงในประวัติการแก้ไข"><Textarea name="editReason" rows={4} placeholder="เช่น ลูกค้าแจ้งเปลี่ยนโรงแรม หรือเปลี่ยนเที่ยวบิน" /></Field>
        </div>
      </section>

      {state.message ? <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{state.message}</div> : null}
      <div className="flex justify-end gap-2"><ButtonLink href={`/airport-transfer/cases/${item.id}`} variant="secondary">ยกเลิก</ButtonLink><Button type="submit" disabled={pending}>{pending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}</Button></div>
    </form>
  );
}
