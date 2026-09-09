# 955 — Agent handoff: performance + de-duplication

**สถานะ:** Task 1–7 ทำแล้ว (commit `5e712cd` → `39f1c4a` + map-merge) · Task 8 ตรวจแล้วไม่มีงานต้องทำ
**ฐานที่ตรวจ:** commit `11e923b` (หลังงาน driver device binding + density pass)
**ขอบเขต:** ประสิทธิภาพการใช้งานจริง (จำนวน query, จำนวน request, ขนาดหน้า) และการลดโค้ด/เมนู/หน้าที่ทับซ้อน
**ไม่อยู่ในขอบเขต:** ฟีเจอร์ใหม่, แอปมือถือ (ดู 953/954), เปลี่ยน schema

กติกาสำหรับ agent ที่มารับงาน:
- ทำทีละ task ให้จบ แล้ว `npm run typecheck && npm run lint && npm test` ก่อนไป task ถัดไป
- commit ต่อ task (ข้อความไทย/อังกฤษก็ได้ แต่บอกว่า "ทำไม" ไม่ใช่แค่ "ทำอะไร")
- **ห้าม push / deploy** เว้นแต่เจ้าของสั่ง
- build เต็มก่อนส่งมอบ: `rm -rf apps/web/.next && npm run build` (บน Windows ต้องลบ `.next` ก่อนเสมอ)
- ห้ามแตะไฟล์ `.env.local`, `vercel.json` (legacy `builds`+`routes` — แก้ผิดแล้ว route พังทั้งระบบ)

---

## สรุปสิ่งที่ตรวจพบ

| # | ปัญหา | หลักฐาน | ผลกระทบ |
|---|---|---|---|
| P1 | หน้าโปรไฟล์รถ 1 คัน ดึงข้อมูล **ทุกคัน ทุกโครงการ** | `lib/data/vehicle-operations.ts:87` `getVehicleOperationProfileById()` เรียก `getVehicleOperationProfiles()` แล้วค่อย `.find()` | หนักสุดในระบบ |
| P2 | N+1 ต่อโครงการ + ต่อ assignment | `vehicle-operations.ts:47-50` (4 query × จำนวนโครงการ) และ `:58` (1 query ต่อ assignment) | ~90 query/หน้า ที่ 10 โครงการ |
| P3 | หน้าศูนย์ควบคุมยิง API ซ้ำ 2 เท่า | `live-location-map.tsx:66` + `fleet-board.tsx:93` ยิง `/locations` ทั้งคู่ · `comms-console.tsx:62` + `fleet-board.tsx:94` ยิง `/comms` ทั้งคู่ | 4 request ต่อรอบ ทั้งที่ต้องการ 2 |
| P4 | คนขับ poll แล้วประกอบข้อมูลใหม่ทั้งก้อนทุก 15 วิ | `app/api/driver/updates/route.ts` เรียก `getDriverAssignmentByToken()` = ~10 query | 50 คนขับ ≈ 33 query/วินาที |
| P5 | ping ตำแหน่ง 1 ครั้ง = 5-6 round trip | `app/api/driver/location/route.ts` (token → assignment → insert → session select → session upsert → timeline) | เส้นทางเขียนที่ร้อนที่สุด |
| P6 | `lib/data/*` แทบไม่มี `cache()` | มีแค่ `projects.ts`; อีก 14 ไฟล์ไม่มี | หน้าเดียวเรียก `getAssignmentsByProjectId` ซ้ำหลายรอบ |
| D1 | `formatRelativeTh` มี **2 ตัว คนละพฤติกรรม** | `lib/format/relative-time-th.ts` ("45 วินาทีที่แล้ว") vs `lib/ui/relative-time.ts` ("เมื่อสักครู่") | เวลาบนจอไม่ตรงกันระหว่างการ์ด |
| D2 | เกณฑ์ความสดของ GPS ก๊อป 5 ที่ | `fleet-board:48`, `live-location-map:37`, `vehicle-monitor-panel:12`, `vehicle-fleet-map:16`, `vehicle-operations-board:14` | แก้เกณฑ์ทีต้องไล่ 5 ไฟล์ |
| D3 | อ่าน metadata ของ location ก๊อป 3 ที่ | `live-location-map:16`, `vehicle-fleet-map:8`, `driver-task-view:33` | — |
| D4 | `VehicleFleetMap` คือ `LiveLocationMap` ที่ก๊อปมาทั้งดุ้น | `components/resources/vehicle-fleet-map.tsx` | logic poll/trail/สี ซ้ำสองชุด |
| D5 | `live-map-panel.tsx` เป็น wrapper เปล่า | ส่ง prop ต่อให้ `LiveLocationMap` เฉยๆ | ชั้นซ้อนไร้ประโยชน์ |
| D6 | ~~หน้าโครงการ 2 ทาง~~ **ตรวจแล้ว ไม่ใช่ปัญหา** | `/projects/[projectId]` เป็น redirect shim ที่จำเป็นตาม `vercel.json` | ไม่ต้องแก้ (ดู Task 8.1) |
| D7 | หน้ารถ 2 ทาง | `/resources/vehicle?vehicleId=` และ `/resources/vehicles/[vehicleId]` | จำเป็นเพราะ vercel.json — แต่ต้องมีคอมเมนต์กำกับ (มีแล้ว) |
| D8 | `/assignments` กับ `/projects/[id]/assignments` ทำงานเดียวกัน | route list | ผู้ใช้เข้าได้ 2 ทาง เห็นไม่เหมือนกัน |
| D9 | นาฬิกา `now` เดินคนละจังหวะ 3 ตัวบนหน้าเดียว | `live-location-map:95`, `fleet-board:110`, `vehicle-fleet-map:38` | อายุ GPS บนแต่ละการ์ดไม่ตรงกัน |

---

## Task 1 — ตัด query ทิ้งครึ่งหนึ่งในหน้ารถ (P1 + P2)

**ไฟล์:** `apps/web/lib/data/vehicle-operations.ts`

**Step 1.1** — `getVehicleOperationProfileById(vehicleId)` ต้องไม่เรียก `getVehicleOperationProfiles()` อีก
แยก core ออกมาเป็นฟังก์ชันที่รับรายการรถ:

```ts
async function buildProfiles(vehicles: Vehicle[]): Promise<VehicleOperationProfile[]> { /* logic เดิม */ }

export async function getVehicleOperationProfiles(): Promise<VehicleOperationProfile[]> {
  return buildProfiles(await getVehicles());
}

export async function getVehicleOperationProfileById(vehicleId: string): Promise<VehicleOperationProfile | null> {
  const vehicle = (await getVehicles()).find((item) => item.id === vehicleId);
  if (!vehicle) return null;
  const [profile] = await buildProfiles([vehicle]);
  return profile ?? null;
}
```
ระวัง: ของเดิมมี fallback ต่อจากบรรทัด 89 (`if (found) return found; ...`) — อ่านให้ครบก่อนแทนที่ อย่าทำ behaviour หาย

**Step 1.2** — ตัด N+1 ต่อโครงการ (บรรทัด 47-50)
`getAssignmentsByProjectId` / `getMissionsByProjectId` ถูกเรียกทีละโครงการ เพิ่มฟังก์ชันแบบหลายโครงการใน `lib/data/assignments.ts` และ `lib/data/missions.ts`:

```ts
export async function getAssignmentsByProjectIds(projectIds: string[]): Promise<Assignment[]>
// ใช้ .in("project_id", projectIds) ครั้งเดียว แล้ว map
```
ทำแบบเดียวกันกับ `getLatestAssignmentStatuses` / `getVehicleEvidenceByProjectId` ถ้าคุ้ม (ทั้งคู่รับ projectId เดี่ยว — เพิ่ม `...ByProjectIds` แล้ว group ในหน่วยความจำ)

**Step 1.3** — ตัด N+1 ต่อ assignment (บรรทัด 58)
`getDriverNotificationsByAssignmentId` ถูกเรียกต่อ assignment เพิ่ม `getDriverNotificationsByAssignmentIds(ids)` ใช้ `.in("assignment_id", ids)` ครั้งเดียว แล้ว group

**Step 1.4** — วัดผล เขียนจำนวน query ก่อน/หลัง ลงท้ายไฟล์ commit message

**เสร็จเมื่อ:** เปิด `/resources/vehicles` และ `/resources/vehicles/<id>` แล้วข้อมูลเหมือนเดิมทุกช่อง · typecheck/lint/test เขียว

---

## Task 2 — เลิกยิง API ซ้ำในศูนย์ควบคุม (P3)

**ไฟล์:** `apps/web/components/mission-control/{live-location-map,fleet-board,comms-console}.tsx` + สร้าง `apps/web/components/mission-control/mission-control-feed.tsx`

ตอนนี้ 3 คอมโพเนนต์บนหน้าเดียวกันต่างคนต่าง poll: map ทุก 10 วิ, fleet ทุก 12 วิ, comms ทุก 15 วิ และดึงซ้ำ endpoint เดียวกัน

**Step 2.1** — สร้าง context provider ตัวเดียวคุม feed ของทั้งหน้า:

```tsx
"use client";
// แหล่งข้อมูลสดของศูนย์ควบคุม: poll ที่เดียว แจกให้ทุกการ์ด
// เดิมแผนที่/กระดานรถ/คอนโซลข้อความต่างคนต่าง poll จน endpoint เดียวถูกยิงซ้ำสองรอบ
export function MissionControlFeedProvider({ projectId, initialLocations, initialComms, children }: …)
export function useMissionControlFeed(): { locations; comms; connection; lastCheckedAt; lastError }
```
- poll `/api/mission-control/locations` และ `/comms` อย่างละครั้งทุก 10 วิ
- subscribe realtime (`subscribeToDriverLocations`) ที่เดียว
- นาฬิกา `now` ตัวเดียว (ตอนนี้มี 3 ตัวเดิน 3 จังหวะ)
- **หยุด poll เมื่อแท็บถูกซ่อน**: `document.visibilityState !== "visible"` → ข้ามรอบนั้น แล้ว refresh ทันทีตอนกลับมา (ประหยัดจริงบนเครื่องศูนย์ที่เปิดค้างทั้งวัน)

**Step 2.2** — ให้ทั้ง 3 คอมโพเนนต์อ่านจาก hook แทน `useEffect` ของตัวเอง ลบ `setInterval` และ `fetch` เดิมออกให้หมด

**Step 2.3** — `app/(app)/mission-control/page.tsx` ครอบด้วย provider ส่ง `initialLocations` / `initialComms` ที่ server ดึงมาแล้วเป็นค่าตั้งต้น (อย่าให้ client ยิงซ้ำรอบแรก)

**เสร็จเมื่อ:** เปิด DevTools → Network บนหน้าศูนย์ควบคุม เห็น `/locations` และ `/comms` อย่างละ 1 request ต่อ 10 วินาที (เดิม 4) · ซ่อนแท็บแล้ว request หยุด

---

## Task 3 — ทำให้ payload คนขับเบาลง (P4)

**ไฟล์:** `apps/web/app/api/driver/updates/route.ts`, `apps/web/lib/data/driver-access.ts`

**Step 3.1** — เพิ่ม `getDriverUpdatesByToken(token)` ใน `driver-access.ts` ที่ดึงเฉพาะที่หน้า poll ใช้จริง: `assignmentStatus`, `latestStatus`, `dayAssignments`, `notifications`, `routeChanges`, `messages`
ห้ามดึง project/mission/vehicle/driver/evidence ซ้ำ — พวกนี้ไม่เปลี่ยนระหว่างงาน หน้าแรกโหลดไปแล้ว
เป้าหมาย: จาก ~10 query เหลือ ≤ 4

**Step 3.2** — route ใช้ฟังก์ชันใหม่ ส่ง `ETag` จาก hash ของ payload และตอบ `304` เมื่อ `if-none-match` ตรง
(คนขับส่วนใหญ่ไม่มีอะไรเปลี่ยนใน 15 วิ — 304 ตัด bandwidth บนมือถือ 3G/4G ที่หน้างานได้จริง)

**Step 3.3** — `components/driver/driver-task-view.tsx` (บรรทัด ~98) ส่ง `if-none-match` และข้ามการ setState เมื่อได้ 304 พร้อมหยุด poll เมื่อหน้าไม่ถูกมอง (`visibilitychange`) แล้ว poll ทันทีตอนกลับมา — สำคัญกับแบตมือถือคนขับ

**เสร็จเมื่อ:** คนขับเปิดงานค้างไว้ 1 นาทีแล้วดู Network เห็น 304 เป็นส่วนใหญ่ · สถานะยังอัปเดตทันทีเมื่อศูนย์ส่งข้อความ

---

## Task 4 — ลดรอบเขียนตอน ping ตำแหน่ง (P5)

**ไฟล์:** `apps/web/app/api/driver/location/route.ts`

ตอนนี้ 1 ping = token lookup → assignment lookup → insert gps → select session → update/insert session → (บางครั้ง) insert timeline

**Step 4.1** — รวม token+assignment เป็น query เดียวด้วย join ที่ `driver_access_tokens` (select `assignment_id, project_id, assignments(vehicle_id)`)

**Step 4.2** — session: เปลี่ยน select-แล้ว-update เป็น `upsert` ครั้งเดียวบน key `(assignment_id)` — ถ้ายังไม่มี unique constraint ให้เขียน migration `database/migrations/0024_driver_location_session_unique.sql` เพิ่ม unique index ก่อน แล้วรัน `node scripts/apply-migrations.mjs --yes` และ `node scripts/sync-supabase-migrations.mjs`

**Step 4.3** — timeline event: เขียนเฉพาะตอนเริ่ม/หยุดแชร์ หรือเมื่อขยับเกิน ~200 ม. ไม่ใช่ทุก ping (ตรวจ logic ปัจจุบันก่อนว่าเขียนบ่อยแค่ไหน — ถ้าเขียนทุก ping ตารางจะบวมเร็วมาก)

**เสร็จเมื่อ:** 1 ping ≤ 3 round trip · แผนที่ศูนย์ยังขยับตามปกติ · ทดสอบผ่าน `/superadmin/dev-tools/live-test`

---

## Task 5 — ใส่ `cache()` ให้ lib/data (P6)

**ไฟล์:** `apps/web/lib/data/{assignments,missions,call-signs,locations,assignment-status,vehicle-evidence,resources,project-members,driver-comms,timeline}.ts`

ห่อ read function ที่ **รับ argument เป็น string ล้วนและไม่มี side effect** ด้วย `cache()` จาก `react` แบบเดียวกับ `lib/data/projects.ts:10` (มีคอมเมนต์อธิบายเหตุผลอยู่แล้ว ให้เขียนคอมเมนต์ทำนองเดียวกัน)

**ห้ามห่อ:** อะไรที่เขียน DB, อะไรที่รับ object เป็น argument (identity ไม่ตรงกัน cache ไม่ทำงาน), และ `getDriverAssignmentByToken` (ใช้ใน route ที่ต้องสดเสมอ)

**เสร็จเมื่อ:** `npm test` เขียว และหน้า mission-control / resources แสดงผลเหมือนเดิม

---

## Task 6 — ยุบตัวช่วยที่ซ้ำ (D1–D3)

**Step 6.1 — เวลา (D1, สำคัญที่สุดในกลุ่มนี้)**
มี `formatRelativeTh` 2 ตัวที่ให้คำตอบต่างกัน ("45 วินาทีที่แล้ว" vs "เมื่อสักครู่") จอเดียวกันจึงเขียนเวลาไม่ตรงกัน
- เก็บ `lib/format/relative-time-th.ts` เป็นตัวจริง (ละเอียดกว่า มี `formatRelativeCompactTh` ด้วย)
- ย้าย test จาก `lib/ui/relative-time.test.ts` มารวม แล้วลบ `lib/ui/relative-time.ts`
- ไล่แก้ import ทุกที่ (`grep -rn "lib/ui/relative-time"`)
- **ตรวจก่อนลบ:** ตัวเก่าตอบ "ยังไม่ระบุ" เมื่อ input เป็น null/undefined ตัวใหม่รับ null ไม่ได้ → เพิ่มการรับ null ให้ตัวที่เก็บไว้ ไม่งั้นการ์ดที่เคยขึ้น "ยังไม่ระบุ" จะพัง

**Step 6.2 — ความสดของ GPS (D2)**
สร้าง `apps/web/lib/domain/gps-freshness.ts`:
```ts
export type GpsFreshness = "live" | "slow" | "offline" | "stopped";
export const GPS_LIVE_SECONDS = 35;
export const GPS_SLOW_SECONDS = 120;
export function gpsFreshness(recordedAt: string, sharingEvent: string | null, now: number): GpsFreshness
export function gpsFreshnessLabelTh(freshness: GpsFreshness): string  // "GPS สด" / "สัญญาณช้า" / "ขาดการอัปเดต" / "หยุดแชร์"
```
เขียน unit test ครอบขอบเขต 35/120 วินาที แล้วให้ 5 ไฟล์ในตาราง D2 เรียกตัวนี้แทน

**Step 6.3 — metadata ของ location (D3)**
ย้าย `metadataText(location, key, fallback)` ไป `lib/data/location-meta.ts` แล้วให้ทั้ง 3 ที่ใช้ร่วมกัน

---

## Task 7 — ยุบแผนที่ให้เหลือชุดเดียว (D4 + D5)

**Step 7.1** — ลบ `components/mission-control/live-map-panel.tsx` (wrapper เปล่า) แล้วให้ `app/(app)/mission-control/page.tsx` เรียก `LiveLocationMap` ตรงๆ

**Step 7.2** — `components/resources/vehicle-fleet-map.tsx` คือ `LiveLocationMap` เวอร์ชันก๊อป
ทำให้ `LiveLocationMap` รับ prop เพิ่ม:
```ts
projectId?: string;       // ไม่ส่ง = ดูทั้งระบบ (หน้าคลังรถ)
height?: number;
showHeader?: boolean;     // หน้าคลังรถไม่ต้องการแถบสถิติด้านบน
```
แล้วลบ `vehicle-fleet-map.tsx` ให้หน้าคลังรถใช้ `LiveLocationMap` ตัวเดียวกัน
**ระวัง:** หน้าคลังรถ fetch `/api/mission-control/locations` โดยไม่ส่ง projectId — ทางฝั่ง route รองรับอยู่แล้ว (`locations/route.ts:8`) อย่าไปแก้ route

---

## Task 8 — ลดหน้าที่ทับซ้อน (D8)

งานนี้กระทบการใช้งานตรงๆ ทำหลังสุด และ **ทำทีละ route อย่าเหมารวด**

**Step 8.1 — โครงการ (D6) → ตรวจแล้วว่า "ถูกอยู่แล้ว ห้ามแตะ"**
ตรวจเมื่อเขียนแผนนี้: `/projects/[projectId]/page.tsx` เป็น redirect shim พร้อมคอมเมนต์กำกับ ชี้ไป `/project?projectId=` และ `vercel.json` มี rewrite `"/projects/([^/]+)"` รองรับบน production อยู่แล้ว — โครงสร้างนี้ **ตรงกับแบบอย่างของ `resources/vehicle` และเป็นสิ่งที่ถูกต้อง** ภายใต้ legacy config
- งานที่ต้องทำ: **ไม่มี** — บันทึกไว้เพื่อไม่ให้ agent ถัดไปเข้าใจผิดว่าเป็นโค้ดซ้ำแล้วไปลบ
- **ห้ามลบ route ใดโดยไม่เช็ค `vercel.json` ก่อน** — production ใช้ legacy `builds`+`routes` ที่ต้องมี rewrite ต่อ dynamic route หนึ่งบรรทัด ลบผิด = 404 บน production เท่านั้น (local ไม่ฟ้อง)

**Step 8.2 — งานที่มอบหมาย (D8) → ตรวจแล้ว: ไม่ใช่หน้าซ้ำ**
`/projects/[projectId]/assignments` เป็น redirect shim (เหมือน D6) ชี้ไป `/assignments?projectId=` ซึ่งเป็นหน้าจริง และ `/assignments` **ไม่ได้อยู่ใน `NAV_SECTIONS`** — เข้าได้ทางเดียวคือแท็บในโครงการ ผู้ใช้จึงไม่เจอ "สองทางเห็นไม่เหมือนกัน"
- เหลือของจริงแค่ลิงก์ที่ไม่สม่ำเสมอ: การ์ดรถบางใบลิงก์ `/assignments` เปล่า (ไม่มี projectId) การ์ดอื่นลิงก์ `/projects/<id>/assignments` — cosmetic ทำเมื่อว่าง ไม่เร่ง
- งานที่ต้องทำในรอบนี้: **ไม่มี**

---

## ลำดับที่แนะนำ

1. Task 6 (ตัวช่วยซ้ำ) — เสี่ยงต่ำ ทำให้ task อื่นสะอาดขึ้น
2. Task 5 (`cache()`) — เสี่ยงต่ำ ได้ผลทันที
3. Task 1 (หน้ารถ) — ได้ผลมากที่สุดต่อแรง
4. Task 2 (feed ศูนย์ควบคุม)
5. Task 3 + 4 (ฝั่งคนขับ) — ทดสอบด้วยมือถือจริงผ่าน `/superadmin/dev-tools/live-test`
6. Task 7 (ยุบแผนที่)
7. Task 8 (route ทับซ้อน) — เสี่ยงสูงสุดเพราะ `vercel.json`

## เกณฑ์ว่างานทั้งชุดเสร็จ

- [ ] `/resources/vehicles/<id>` ไม่ดึงข้อมูลรถคันอื่นอีก
- [ ] หน้าศูนย์ควบคุมยิง API 2 request ต่อ 10 วิ (ไม่ใช่ 4) และหยุดเมื่อซ่อนแท็บ
- [ ] `/api/driver/updates` ตอบ 304 เมื่อไม่มีอะไรเปลี่ยน
- [ ] 1 ping ตำแหน่ง ≤ 3 round trip
- [ ] `grep -rn "age <= 35"` เจอที่เดียว
- [ ] `formatRelativeTh` มีนิยามเดียว
- [ ] ไม่มี `live-map-panel.tsx` และ `vehicle-fleet-map.tsx`
- [ ] typecheck · lint · test · clean build เขียวทั้งหมด
- [ ] ยังไม่ push จนกว่าเจ้าของจะสั่ง
