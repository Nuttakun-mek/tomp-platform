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
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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
  const [arrivalTime, setArrivalTime] = useState("");
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
    setDepartureTime(toDateTimeLocal(candidate.scheduledDepartureLocal));
    setArrivalTime(toDateTimeLocal(candidate.scheduledArrivalLocal));
  }

  function invalidateFlightLookup() {
    setFlightLookup(null);
    setOriginAirport("");
    setOriginAirportName(null);
    setDestinationAirport("");
    setDestinationAirportName(null);
    setDepartureTime("");
    setArrivalTime("");
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
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="ประเภทบริการ">
            <Select name="direction" value={direction} onChange={(event) => setDirection(event.target.value as "arrival" | "departure")}>
              <option value="arrival">รับเข้าจากสนามบิน → ที่พัก</option>
              <option value="departure">ส่งออกจากที่พัก → สนามบิน</option>
            </Select>
          </Field>
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
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label="วันเดินทาง *" error={errors.travelDate}>
            <Input name="travelDate" type="date" required value={travelDate} onChange={(event) => { setTravelDate(event.target.value); invalidateFlightLookup(); }} />
          </Field>
          <Field label="หมายเลขเที่ยวบิน *" hint="เช่น TG931" error={errors.flightNumber}>
            <Input name="flightNumber" placeholder="TG931" required value={flightNumber} onChange={(event) => { setFlightNumber(event.target.value.toUpperCase()); invalidateFlightLookup(); }} />
          </Field>
          <div className="flex items-end lg:col-span-2">
            <Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={isCheckingFlight || !travelDate || flightNumber.trim().length < 2} onClick={checkFlight}>
              {isCheckingFlight ? "กำลังตรวจสอบเที่ยวบิน..." : "ตรวจสอบเที่ยวบิน"}
            </Button>
          </div>

          {flightLookup ? (
            <div role="status" className={`rounded-xl border px-4 py-3 text-sm md:col-span-2 lg:col-span-4 ${flightLookup.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
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

          <Field label="สนามบินต้นทาง" hint={originAirportName || "ระบบจะเติมหลังตรวจสอบเที่ยวบิน"}>
            <Input name="originAirport" maxLength={3} value={originAirport} onChange={(event) => setOriginAirport(event.target.value.toUpperCase())} />
          </Field>
          <Field label="สนามบินปลายทาง" hint={destinationAirportName || "ระบบจะเติมหลังตรวจสอบเที่ยวบิน"}>
            <Input name="destinationAirport" maxLength={3} value={destinationAirport} onChange={(event) => setDestinationAirport(event.target.value.toUpperCase())} />
          </Field>
          <Field label="เวลาออก" hint="เวลาท้องถิ่นของสนามบินต้นทาง">
            <Input name="scheduledDepartureLocal" type="datetime-local" value={departureTime} onChange={(event) => setDepartureTime(event.target.value)} />
          </Field>
          <Field label="เวลาถึง" hint="เวลาท้องถิ่นของสนามบินปลายทาง">
            <Input name="scheduledArrivalLocal" type="datetime-local" value={arrivalTime} onChange={(event) => setArrivalTime(event.target.value)} />
          </Field>
        </div>
      </Section>

      <Section number="4" title="จุดรับ จุดส่ง และเวลา" description={direction === "departure" ? `เวลาแนะนำเบื้องต้นก่อนเที่ยวบิน 3 ชั่วโมง: ${suggestedDeparturePickup}` : "กรณีรับเข้า ระบบแนะนำเวลาเตรียมรับหลังเครื่องลง 45 นาทีจนกว่าจะตั้งกฎเฉพาะสนามบิน"}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="ชื่อจุดรับ *" error={errors.pickupName}><Input name="pickupName" placeholder={direction === "arrival" ? "สนามบินสุวรรณภูมิ จุดนัดพบ" : "ชื่อโรงแรม"} required /></Field>
          <Field label="ชื่อจุดส่ง *" error={errors.dropoffName}><Input name="dropoffName" placeholder={direction === "arrival" ? "ชื่อโรงแรม" : "สนามบินสุวรรณภูมิ"} required /></Field>
          <Field label="ที่อยู่จุดรับ"><Input name="pickupAddress" /></Field>
          <Field label="ที่อยู่จุดส่ง"><Input name="dropoffAddress" /></Field>
          <Field label="Google Maps จุดรับ"><Input name="pickupMapsUrl" type="url" /></Field>
          <Field label="Google Maps จุดส่ง"><Input name="dropoffMapsUrl" type="url" /></Field>
          <Field label="เวลารับที่ยืนยัน" hint="ปล่อยว่างเพื่อใช้เวลาที่ระบบแนะนำ"><Input name="confirmedPickupLocal" type="datetime-local" /></Field>
          <Field label="เหตุผลที่ปรับเวลา"><Input name="pickupTimeOverrideReason" /></Field>
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
