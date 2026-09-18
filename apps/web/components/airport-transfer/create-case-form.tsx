"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  createAirportTransferCase,
  lookupAirportTransferFlight,
  type CreateTransferCaseState,
  type FlightLookupCandidate,
  type FlightLookupState
} from "@/app/airport-transfer/actions";
import { Button } from "@/components/ui/button";
import { DateTimeField } from "@/components/ui/datetime-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDown, ArrowRight, Building2, MapPin, PlaneLanding, PlaneTakeoff } from "lucide-react";

const initialState: CreateTransferCaseState = { ok: false, message: "" };

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string[]; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs font-normal text-slate-500">{hint}</span> : null}
      {error?.length ? <span className="text-xs font-normal text-red-700">{error[0]}</span> : null}
    </label>
  );
}

function Section({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-100 text-sm font-bold text-cyan-900">{number}</span>
        <div><h2 className="text-lg font-semibold text-slate-950">{title}</h2><p className="mt-0.5 text-sm text-slate-500">{description}</p></div>
      </div>
      {children}
    </section>
  );
}

function formatSuggestedTime(value: string) {
  if (!value) return "กรอกเวลาเที่ยวบินเพื่อคำนวณ";
  const date = new Date(`${value}:00+07:00`);
  if (Number.isNaN(date.getTime())) return "—";
  date.setHours(date.getHours() - 3);
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(date);
}

function toDateTimeLocal(value: string) {
  const normalized = value.replace(" ", "T");
  const match = normalized.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  return match?.[0] || "";
}

function subtractHours(value: string, hours: number) {
  if (!value || !Number.isFinite(hours)) return "";
  const date = new Date(`${toDateTimeLocal(value)}:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - hours * 60);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function CreateAirportTransferCaseForm() {
  const [state, formAction, pending] = useActionState(createAirportTransferCase, initialState);
  const [isCheckingFlight, startFlightCheck] = useTransition();
  const [direction, setDirection] = useState<"arrival" | "departure">("arrival");
  const [travelDate, setTravelDate] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [originAirport, setOriginAirport] = useState("");
  const [originAirportName, setOriginAirportName] = useState<string | null>(null);
  const [destinationAirport, setDestinationAirport] = useState("");
  const [destinationAirportName, setDestinationAirportName] = useState<string | null>(null);
  const [departureTime, setDepartureTime] = useState("");
  const [departureUtc, setDepartureUtc] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [arrivalUtc, setArrivalUtc] = useState("");
  const [pickupLeadHours, setPickupLeadHours] = useState(3);
  const [confirmedPickupTime, setConfirmedPickupTime] = useState("");
  const [flightLookup, setFlightLookup] = useState<FlightLookupState | null>(null);
  const [selectedFlightIndex, setSelectedFlightIndex] = useState(0);
  const suggestedDeparturePickup = useMemo(() => formatSuggestedTime(departureTime), [departureTime]);
  const errors = state.fieldErrors || {};

  function applyFlight(candidate: FlightLookupCandidate, index: number) {
    setSelectedFlightIndex(index);
    setFlightNumber(candidate.flightNumber);
    setOriginAirport(candidate.originAirport);
    setOriginAirportName(candidate.originAirportName);
    setDestinationAirport(candidate.destinationAirport);
    setDestinationAirportName(candidate.destinationAirportName);
    const nextDepartureTime = toDateTimeLocal(candidate.scheduledDepartureLocal);
    setDepartureTime(nextDepartureTime);
    setDepartureUtc(candidate.scheduledDepartureAt || "");
    setArrivalTime(toDateTimeLocal(candidate.scheduledArrivalLocal));
    setArrivalUtc(candidate.scheduledArrivalAt || "");
    if (direction === "departure") setConfirmedPickupTime(subtractHours(nextDepartureTime, pickupLeadHours));
  }

  function invalidateFlightLookup() {
    setFlightLookup(null);
    setOriginAirport("");
    setOriginAirportName(null);
    setDestinationAirport("");
    setDestinationAirportName(null);
    setDepartureTime("");
    setDepartureUtc("");
    setArrivalTime("");
    setArrivalUtc("");
    setConfirmedPickupTime("");
  }

  function checkFlight() {
    startFlightCheck(async () => {
      const result = await lookupAirportTransferFlight({ travelDate, flightNumber });
      setFlightLookup(result);
      if (result.ok) applyFlight(result.candidates[0], 0);
    });
  }

  return (
    <form action={formAction} className="grid gap-4">
      <Section number="1" title="ประเภทบริการ" description="เลือกทิศทางการเดินทางและลูกค้าผู้ว่าจ้าง">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,1fr)]">
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-slate-700">ประเภทบริการ</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                { value: "arrival", title: "รับเข้าจากสนามบิน", detail: "สนามบิน → ที่พัก", icon: PlaneLanding },
                { value: "departure", title: "ส่งออกไปสนามบิน", detail: "ที่พัก → สนามบิน", icon: PlaneTakeoff }
              ] as const).map(({ value, title, detail, icon: Icon }) => (
                <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${direction === value ? "border-cyan-700 bg-cyan-50 text-cyan-950 ring-2 ring-cyan-100" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}>
                  <input type="radio" name="direction" value={value} checked={direction === value} onChange={() => { setDirection(value); setConfirmedPickupTime(value === "departure" ? subtractHours(departureTime, pickupLeadHours) : ""); }} className="sr-only" />
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${direction === value ? "bg-cyan-700 text-white" : "bg-slate-100 text-slate-500"}`}><Icon className="h-5 w-5" /></span>
                  <span><span className="block text-sm font-bold">{title}</span><span className="block text-xs text-slate-500">{detail}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="ชื่อลูกค้า/บริษัท"><Input name="clientName" placeholder="เช่น ABC Corporation" /></Field>
        </div>
      </Section>

      <Section number="2" title="ข้อมูลผู้โดยสาร" description="ระยะแรกสร้างหนึ่งการ์ดต่อผู้โดยสารหรือผู้ติดต่อหลัก">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label="คำนำหน้า"><Select name="passengerTitle" defaultValue=""><option value="">ไม่ระบุ</option><option>Mr.</option><option>Mrs.</option><option>Ms.</option><option>Dr.</option></Select></Field>
          <Field label="ชื่อ *" error={errors.passengerFirstName}><Input name="passengerFirstName" required /></Field>
          <Field label="นามสกุล *" error={errors.passengerLastName}><Input name="passengerLastName" required /></Field>
          <Field label="เบอร์โทรศัพท์"><Input name="passengerMobile" inputMode="tel" /></Field>
          <Field label="อีเมล" error={errors.passengerEmail}><Input name="passengerEmail" type="email" /></Field>
          <Field label="จำนวนผู้โดยสาร"><Input name="passengerCount" type="number" min="1" defaultValue="1" /></Field>
          <Field label="จำนวนกระเป๋า"><Input name="luggageCount" type="number" min="0" defaultValue="0" /></Field>
          <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"><input name="fastTrack" type="checkbox" /> Fast Track</label>
        </div>
      </Section>

      <Section number="3" title="เที่ยวบิน" description="ระบุวันเดินทางและหมายเลขเที่ยวบิน แล้วกดตรวจสอบเพื่อเติมสนามบินและเวลาให้อัตโนมัติ">
        <div className="grid gap-4">
          <div className="grid items-start gap-3 md:grid-cols-[minmax(220px,0.8fr)_minmax(220px,0.8fr)_minmax(180px,1fr)]">
          <div><DateTimeField label="วันเดินทาง" name="travelDate" required value={travelDate} onChange={(value) => { setTravelDate(value); invalidateFlightLookup(); }} />{errors.travelDate?.length ? <p className="text-xs text-red-700">{errors.travelDate[0]}</p> : null}</div>
          <Field label="หมายเลขเที่ยวบิน *" hint="เช่น TG931" error={errors.flightNumber}>
            <Input name="flightNumber" placeholder="TG931" required value={flightNumber} onChange={(event) => { setFlightNumber(event.target.value.toUpperCase()); invalidateFlightLookup(); }} />
          </Field>
          <div className="flex items-start pt-[22px]">
            <Button type="button" variant="secondary" className="w-full min-h-[42px]" disabled={isCheckingFlight || !travelDate || flightNumber.trim().length < 2} onClick={checkFlight}>
              {isCheckingFlight ? "กำลังตรวจสอบเที่ยวบิน..." : "ตรวจสอบเที่ยวบิน"}
            </Button>
          </div>
          </div>

          {flightLookup ? (
            <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${flightLookup.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
              <p className="font-semibold">{flightLookup.message}</p>
              {flightLookup.ok && flightLookup.candidates.length > 1 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {flightLookup.candidates.map((candidate, index) => (
                    <button key={`${candidate.flightNumber}-${candidate.originAirport}-${candidate.destinationAirport}-${index}`} type="button" onClick={() => applyFlight(candidate, index)} className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${selectedFlightIndex === index ? "border-emerald-700 bg-white text-emerald-900" : "border-emerald-200 bg-emerald-100/60 text-emerald-800 hover:bg-white"}`}>
                      {candidate.originAirport} → {candidate.destinationAirport} · {toDateTimeLocal(candidate.scheduledDepartureLocal).replace("T", " ")}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid items-stretch gap-2 lg:grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="mb-3 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-100 text-cyan-800"><PlaneTakeoff className="h-4 w-4" /></span><div><p className="text-sm font-bold text-slate-900">สนามบินต้นทาง</p><p className="text-xs text-slate-500">Departure</p></div></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="สนามบิน" hint={originAirportName || "ระบบจะเติมหลังตรวจสอบ"}><Input name="originAirport" maxLength={3} placeholder="เช่น BKK" value={originAirport} onChange={(event) => setOriginAirport(event.target.value.toUpperCase())} /></Field>
                <DateTimeField label="เวลาออก" name="scheduledDepartureLocal" withTime value={departureTime} hint="เวลาท้องถิ่นต้นทาง" onChange={(value) => { setDepartureTime(value); setDepartureUtc(""); if (direction === "departure") setConfirmedPickupTime(subtractHours(value, pickupLeadHours)); }} />
                <input name="scheduledDepartureUtc" type="hidden" value={departureUtc} />
              </div>
            </div>
            <div className="grid place-items-center text-slate-300"><ArrowRight className="hidden h-5 w-5 lg:block" /><ArrowDown className="h-5 w-5 lg:hidden" /></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="mb-3 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-100 text-blue-800"><PlaneLanding className="h-4 w-4" /></span><div><p className="text-sm font-bold text-slate-900">สนามบินปลายทาง</p><p className="text-xs text-slate-500">Arrival</p></div></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="สนามบิน" hint={destinationAirportName || "ระบบจะเติมหลังตรวจสอบ"}><Input name="destinationAirport" maxLength={3} placeholder="เช่น HKT" value={destinationAirport} onChange={(event) => setDestinationAirport(event.target.value.toUpperCase())} /></Field>
                <DateTimeField label="เวลาถึง" name="scheduledArrivalLocal" withTime value={arrivalTime} hint="เวลาท้องถิ่นปลายทาง" onChange={(value) => { setArrivalTime(value); setArrivalUtc(""); }} />
                <input name="scheduledArrivalUtc" type="hidden" value={arrivalUtc} />
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section number="4" title="จุดรับ จุดส่ง และเวลา" description={direction === "departure" ? `เวลาแนะนำเบื้องต้นก่อนเที่ยวบิน 3 ชั่วโมง: ${suggestedDeparturePickup}` : "กรณีรับเข้า ระบบแนะนำเวลาเตรียมรับหลังเครื่องลง 45 นาทีจนกว่าจะตั้งกฎเฉพาะสนามบิน"}>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50/40 p-3">
            <div className="mb-3 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-700 text-white"><MapPin className="h-4 w-4" /></span><div><p className="text-sm font-bold">จุดรับผู้โดยสาร</p><p className="text-xs text-slate-500">Pickup location</p></div></div>
            <div className="grid gap-3"><Field label="ชื่อจุดรับ *" error={errors.pickupName}><Input name="pickupName" placeholder={direction === "arrival" ? "สนามบินสุวรรณภูมิ จุดนัดพบ" : "ชื่อโรงแรม"} required /></Field><Field label="ที่อยู่จุดรับ"><Input name="pickupAddress" /></Field><Field label="Google Maps จุดรับ"><Input name="pickupMapsUrl" type="url" placeholder="วางลิงก์ Google Maps" /></Field></div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-3">
            <div className="mb-3 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-700 text-white"><Building2 className="h-4 w-4" /></span><div><p className="text-sm font-bold">จุดส่งผู้โดยสาร</p><p className="text-xs text-slate-500">Drop-off location</p></div></div>
            <div className="grid gap-3"><Field label="ชื่อจุดส่ง *" error={errors.dropoffName}><Input name="dropoffName" placeholder={direction === "arrival" ? "ชื่อโรงแรม" : "สนามบินสุวรรณภูมิ"} required /></Field><Field label="ที่อยู่จุดส่ง"><Input name="dropoffAddress" /></Field><Field label="Google Maps จุดส่ง"><Input name="dropoffMapsUrl" type="url" placeholder="วางลิงก์ Google Maps" /></Field></div>
          </div>
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 lg:col-span-2 lg:grid-cols-[minmax(0,1fr)_180px_minmax(220px,1fr)]">
            <DateTimeField label="เวลารับที่ยืนยัน" name="confirmedPickupLocal" withTime value={confirmedPickupTime} hint={direction === "departure" ? `อัตโนมัติก่อนเครื่องออก ${pickupLeadHours} ชั่วโมง` : "ปล่อยว่างเพื่อใช้เวลาที่ระบบแนะนำ"} onChange={setConfirmedPickupTime} />
            <Field label="รับล่วงหน้า (ชั่วโมง)" hint="ค่าเริ่มต้น 3 ชั่วโมง"><Input name="pickupLeadHours" type="number" min="0" max="24" step="0.5" value={pickupLeadHours} disabled={direction !== "departure"} onChange={(event) => { const hours = Number(event.target.value); setPickupLeadHours(hours); setConfirmedPickupTime(subtractHours(departureTime, hours)); }} /></Field>
            <Field label="เหตุผลที่ปรับเวลา"><Input name="pickupTimeOverrideReason" placeholder="ระบุเมื่อเปลี่ยนจากเวลาที่ระบบแนะนำ" /></Field>
          </div>
        </div>
      </Section>

      <Section number="5" title="รถและคนขับ" description="สามารถสร้างเคสก่อนจัดรถได้ ระบบจะแสดงเป็นงานที่ยังไม่ได้มอบหมาย">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label="ประเภทรถ"><Select name="vehicleType" defaultValue=""><option value="">ยังไม่กำหนด</option><option value="sedan">Sedan</option><option value="executive_sedan">Executive Sedan</option><option value="van">Van</option><option value="luxury_van">Luxury Van</option></Select></Field>
          <Field label="ทะเบียนรถ"><Input name="vehiclePlate" /></Field>
          <Field label="ชื่อคนขับ"><Input name="driverName" /></Field>
          <Field label="เบอร์โทรคนขับ"><Input name="driverPhone" inputMode="tel" /></Field>
        </div>
      </Section>

      <Section number="6" title="หมายเหตุ" description="ข้อมูลสำหรับศูนย์ปฏิบัติการในระยะแรก">
        <Field label="หมายเหตุ"><Textarea name="notes" rows={4} /></Field>
      </Section>

      {state.message ? <div className={`rounded-xl border px-4 py-3 text-sm ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{state.message}</div> : null}
      <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? "กำลังตรวจสอบและบันทึก..." : "สร้างการ์ดข้อมูล"}</Button></div>
    </form>
  );
}
