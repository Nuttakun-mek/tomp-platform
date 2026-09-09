# 956 — Agent handoff: job ordering (centre side) + page length

**สถานะ:** เสร็จทั้ง 4 task (commit b85c912, 4d5c1e8)
**ฐาน:** commit `751b75d` (หลังงานฝั่งคนขับ: today-list ordering + tap-to-expand)
**ที่มา:** ผู้ใช้ทดสอบแล้วพบ 3 เรื่อง — ฝั่งคนขับแก้ไปแล้วบางส่วนใน `751b75d` ที่เหลือคือฝั่งศูนย์

กติกาเดิม: ทำทีละ task · `npm run typecheck && npm run lint && npm test` ก่อนไปต่อ · commit ต่อ task · **ห้าม push/deploy เว้นแต่สั่ง** · Windows ต้อง `rm -rf apps/web/.next` ก่อน build

---

## บริบท — อะไรทำไปแล้วใน `751b75d`

ฝั่งคนขับ ([driver-task-view.tsx](../../apps/web/components/driver/driver-task-view.tsx), [driver-access.ts](../../apps/web/lib/data/driver-access.ts)):
- การ์ด "งานวันนี้" **เรียงใหม่แล้ว**: งานปัจจุบัน → งานด่วน/แทรก → ที่เหลือเรียงตามเวลาเริ่ม → completed/cancelled ลงล่าง
- แต่ละแถว **แตะเพื่อกางดูรายละเอียด** (จุดรับ/ส่งเต็ม, ช่วงเวลา, ปุ่มเส้นทาง Maps ต่องาน) พร้อมป้าย "ทำต่อไป" / "ด่วน"
- การ์ดแชร์ตำแหน่งแยกเป็นการ์ดของตัวเอง ไม่ปนกับการ์ดงาน

**`buildDayAssignments()` ใน driver-access.ts อ่านค่าเหล่านี้จาก `assignment.metadata` อยู่แล้ว — ฝั่งศูนย์แค่ต้องเขียนลงไป:**
| key | ชนิด | ความหมาย |
|---|---|---|
| `metadata.sequence` | number | ลำดับที่ศูนย์กำหนด (ชนะการเรียงตามเวลาในกลุ่มเดียวกัน) |
| `metadata.urgent` | boolean | งานด่วน/แทรก — ดันขึ้นมาอยู่หลังงานปัจจุบันทันที + ป้าย "ด่วน" |
| `metadata.priority` | `"urgent"` \| `"high"` | ทางเลือกแทน `urgent: true` |

---

## Task 1 — ศูนย์กำหนดลำดับและงานด่วนได้ (ตอบ "ระบบตรวจว่างานไหนก่อนหลังไหม")

ตอนนี้ dispatcher สร้าง assignment ได้ แต่กำหนด "ทำก่อน/หลัง" ไม่ได้เลย — คนขับเห็นตามเวลาเริ่ม ถ้าไม่กรอกเวลาก็ตามลำดับสร้าง

**ไฟล์:**
- `apps/web/app/actions/assignments.ts` — action ใหม่
- `apps/web/components/assignments/dispatch-board.tsx` + lane/card — ปุ่มจัดลำดับ
- `packages/types/schemas.ts` — schema ของ action

**Step 1.1** — action `setAssignmentOrderAction(input)`:
```ts
// input: { projectId, driverId, orderedAssignmentIds: string[], urgentAssignmentIds?: string[] }
// requirePermission(projectId, "assignment.update")
// สำหรับแต่ละ assignment ของ driver ในวันนั้น: merge metadata.sequence = ตำแหน่งใน array (1-based)
//   และ metadata.urgent = ordered… อยู่ใน urgentAssignmentIds
// เขียนเป็น batch update (client.from("assignments").update({ metadata }).eq("id", id)) ต่อรายการ
// revalidatePath("/assignments") + `/projects/${projectId}/assignments`
```
ระวัง: `metadata` เป็น jsonb ทั้งก้อน — ต้อง select metadata เดิมมา merge ก่อน อย่าเขียนทับ

**Step 1.2** — UI: ในบอร์ดจัดสรรงาน เพิ่มมุมมอง "ตามคนขับ" (group assignments ตาม `driverId`) แต่ละกลุ่มลากจัดลำดับได้ (ใช้ `@dnd-kit` ถ้ามีอยู่แล้ว ไม่งั้นปุ่มลูกศรขึ้น/ลง — เช็ค `package.json` ก่อน; ถ้าไม่มีให้ใช้ปุ่มลูกศร ไม่ต้องเพิ่ม dep) + ปุ่ม toggle "ด่วน" ต่องาน
- กด "บันทึกลำดับ" → เรียก `setAssignmentOrderAction`
- ค่าเริ่มต้นของลำดับ = เรียงตามเวลาเริ่มเหมือนที่คนขับเห็น (ให้ logic ตรงกับ `buildDayAssignments`)

**Step 1.3** — ตรวจความขัดแย้งเวลา (ส่วน "ระบบตรวจสอบ"):
เพิ่ม helper `apps/web/lib/domain/assignment-conflicts.ts`:
```ts
export function findDriverTimeConflicts(assignments: {id; driverId; startTime; endTime}[]): Array<{ a: string; b: string }>
// คู่ที่ driver เดียวกันและช่วงเวลาทับกัน
```
แสดงแถบเตือนในบอร์ด "คนขับ X มีงานเวลาชนกัน 2 งาน" — เขียน unit test ครอบเคสทับ/ไม่ทับ/ไม่มีเวลา

**เสร็จเมื่อ:** dispatcher จัดลำดับงานของคนขับ 1 คนแล้วกดบันทึก → เปิด QR คนขับคนนั้นเห็นลำดับตรงกัน · toggle "ด่วน" → ขึ้นป้าย "ด่วน" ที่เครื่องคนขับ · งานเวลาชนกันมีแถบเตือน

---

## Task 2 — "งานถัดไป" ให้ศูนย์เห็นด้วย

ฝั่งคนขับมีป้าย "ทำต่อไป" แล้ว ศูนย์ควรเห็นเหมือนกันบนกระดานรถ

**ไฟล์:** `apps/web/components/mission-control/fleet-board.tsx`

- ในแต่ละแถวของกระดานรถ ถ้า assignment นั้นเป็น "งานถัดไป" ของคนขับ (คนขับคนเดียวกัน งานที่ยังไม่ completed ที่มี sequence/เวลาน้อยสุดถัดจากงานที่ active อยู่) → ป้าย "ถัดไป"
- ใช้ logic เดียวกับ `buildDayAssignments` — พิจารณาแยก helper ที่ import ได้ทั้งสองฝั่ง (`lib/domain/driver-day-order.ts`) เพื่อไม่ให้ตรรกะแตกกันอีก

**เสร็จเมื่อ:** กระดานรถแสดง "ถัดไป" ตรงกับที่คนขับเห็น

---

## Task 3 — หน้าที่ยาวเกินเมื่อข้อมูลเยอะ

**ปัญหา:** ทุกหน้าฝั่งศูนย์ render ทุกแถวเสมอ — 50 คนขับ / 200 งาน = หน้ายาวมาก เลื่อนหากันไม่เจอ

| หน้า/การ์ด | ไฟล์ | ทำ |
|---|---|---|
| กระดานรถ | [fleet-board.tsx](../../apps/web/components/mission-control/fleet-board.tsx) | เริ่มแสดง 15 แถว (เรียงตาม attention rank เดิม) + ปุ่ม "ดูทั้งหมด (N)" · แถวที่ "ต้องติดตาม" ไม่ถูกซ่อน |
| คอนโซลข้อความ | [comms-console.tsx](../../apps/web/components/mission-control/comms-console.tsx) | มี `.slice(-60)` แล้ว — เพิ่มปุ่ม "โหลดเก่ากว่านี้" ทีละ 60 |
| บอร์ดจัดสรรงาน (lane) | [assignment-lane.tsx](../../apps/web/components/assignments/assignment-lane.tsx) | แต่ละ lane แสดง 10 การ์ด + "ดูอีก N" |
| ไทม์ไลน์ปฏิบัติการ | [operation-timeline-panel.tsx](../../apps/web/components/mission-control/operation-timeline-panel.tsx) | แสดง 20 เหตุการณ์ล่าสุด + "ดูเพิ่ม" |
| งานวันนี้ (คนขับ) | [driver-task-view.tsx](../../apps/web/components/driver/driver-task-view.tsx) | ปกติ ≤ 10 ต่อวัน — ไม่ต้องทำ เว้นแต่เจอเคสเกิน 15 |

รูปแบบที่ใช้ซ้ำได้: hook เล็ก ๆ `useVisibleSlice(items, initial)` คืน `{ visible, hasMore, showMore }` — สร้างที่ `apps/web/components/ui/use-visible-slice.ts` เขียน test

**อย่าทำ:** virtualization library (เกินจำเป็นสำหรับสเกลนี้) · เปลี่ยน query ให้ paginate ที่ DB (ข้อมูลต่อโครงการยังเล็กพอ ดึงหมดได้ ตัดที่ client พอ)

**เสร็จเมื่อ:** ใส่ข้อมูลจำลอง 100+ แถว ทุกหน้ายังเปิดเร็ว หน้าจอไม่ยาวเกิน 3–4 เท่าของ viewport ก่อนกด "ดูทั้งหมด"

---

## Task 4 — (เล็ก) ลิงก์ไป dispatch ให้สม่ำเสมอ

การ์ดรถบางใบลิงก์ `/assignments` เปล่า (ไม่มี projectId) → เด้งไป `/projects`
- [vehicle-operations-board.tsx:27](../../apps/web/components/resources/vehicle-operations-board.tsx#L27) และ [vehicle-profile-detail.tsx:95](../../apps/web/components/resources/vehicle-profile-detail.tsx#L95)
- ทั้งสองไฟล์มี `assignment.projectId` ต่อ task อยู่แล้ว — ถ้าลิงก์อยู่ระดับการ์ดรวม ให้ชี้ไป `/projects` พร้อมข้อความ "เลือกโครงการเพื่อจัดงาน" หรือถ้าระดับ task ให้ใช้ `/projects/${projectId}/assignments`

---

## ลำดับที่แนะนำ
1. Task 3 (page length) — เสี่ยงต่ำ เห็นผลทุกหน้า
2. Task 1 (จัดลำดับ) — งานหลัก
3. Task 2 (ป้าย "ถัดไป" ฝั่งศูนย์) — ต่อยอด Task 1
4. Task 4 — จบด้วยของเล็ก

## เกณฑ์เสร็จทั้งชุด
- [ ] dispatcher จัดลำดับ + mark ด่วน แล้วคนขับเห็นตรงกัน
- [ ] งานเวลาชนกันมีแถบเตือนฝั่งศูนย์
- [ ] กระดานรถ/คอนโซล/lane/ไทม์ไลน์ ไม่ render เกิน ~15–20 แถวก่อนกด "ดูทั้งหมด"
- [ ] `lib/domain/driver-day-order.ts` เป็นแหล่งเดียวของตรรกะการเรียง (คนขับ + ศูนย์ import ตัวเดียวกัน)
- [ ] typecheck · lint · test · clean build เขียว
- [ ] ยังไม่ push
