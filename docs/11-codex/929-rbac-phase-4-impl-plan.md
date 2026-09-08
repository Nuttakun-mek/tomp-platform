# RBAC Phase 4 — Workspace UX + error-reduction Implementation Plan

> **For agentic workers:** superpowers:executing-plans — task-by-task, verify ทุก task, ไม่ push จนกว่าจะ review.

**Goal:** ทำให้ผู้ใช้แต่ละ role เปิดหน้าแล้วรู้ทันทีว่า *อยู่ที่ไหน / ทำอะไรได้ / อะไรรอตัดสินใจ / ใครรับผิดชอบ* และลดความผิดพลาดการประสานงานผ่าน UI pattern (§7 ของ [922](922-production-rbac-ux-restructure-plan.md))

**Architecture:** primitive UI ใหม่ใน `components/ui/` (pure, testable) → wire เข้าหน้า operational + สร้าง `/portal` (read-only) + home section-by-permission

**Tech Stack:** React server/client components · Tailwind design-system tokens · vitest · lucide-react

## Global Constraints

- ใช้ design-system เดิม: `.smart-card` `.enterprise-panel` `text-ink/-soft/-faint` `operation/-soft/-deep` `rounded-card/-panel` `.field-*`
- copy ไทยตาม [505](../05-ux/505-thai-copy-guideline.md); ไม่มี raw enum / ISO date หลุด — ใช้ `formatStatusTh` / `roleLabelTh`
- ทุก task: typecheck + lint + test เขียว; ห้าม build ขณะ dev รัน
- Phase 4 **ไม่แตะ** RLS / migration / data client (เสร็จใน Phase 3)
- Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

---

## File Structure

| ไฟล์ | หน้าที่ |
|---|---|
| `apps/web/lib/ui/owner-line.ts` (+ `.test.ts`) | pure — `formatOwnerLine({name, roleKey, at})` → "สมชาย · ผู้จ่ายงาน · 5 นาทีที่แล้ว" |
| `apps/web/lib/ui/relative-time.ts` (+ `.test.ts`) | pure — `formatRelativeTh(iso, now?)` |
| `apps/web/components/ui/owner-tag.tsx` | `<OwnerTag name roleKey? at? />` |
| `apps/web/components/ui/contact-strip.tsx` | `<ContactStrip contacts={{role,name,phone?}[]} />` — ปุ่มโทร/SMS |
| `apps/web/components/ui/conflict-warning.tsx` | `<ConflictWarning conflicts={string[]} onOverride? />` inline แดง |
| `apps/web/components/ui/notification-card.tsx` | `<NotificationCard title body? tone? actionHref? actionLabel? at? />` |
| `apps/web/lib/domain/assignment-rules.ts` | + `describeAssignmentConflicts(candidate, existing)` → string[] ไทย |
| `apps/web/app/portal/page.tsx` + `layout.tsx` | organizer/customer read-only workspace |
| `apps/web/components/portal/*` | `portal-project-card.tsx`, `portal-mission-status.tsx` |
| `apps/web/app/page.tsx` | section-by-permission ผ่าน `getViewerAccess()` |

---

## Task 23 — pure helpers: relative time + owner line

**Files:** Create `apps/web/lib/ui/relative-time.ts` + `.test.ts`, `apps/web/lib/ui/owner-line.ts` + `.test.ts`

- [ ] **Step 1: test `relative-time`**

```ts
import { formatRelativeTh } from "./relative-time";
const now = new Date("2026-09-08T12:00:00Z").getTime();
expect(formatRelativeTh("2026-09-08T11:59:30Z", now)).toBe("เมื่อสักครู่");
expect(formatRelativeTh("2026-09-08T11:55:00Z", now)).toBe("5 นาทีที่แล้ว");
expect(formatRelativeTh("2026-09-08T09:00:00Z", now)).toBe("3 ชั่วโมงที่แล้ว");
expect(formatRelativeTh("2026-09-06T12:00:00Z", now)).toBe("2 วันที่แล้ว");
expect(formatRelativeTh(null, now)).toBe("ยังไม่ระบุ");
```

- [ ] **Step 2: implement** `formatRelativeTh(iso: string | null | undefined, now = Date.now()): string` — `< 60s` "เมื่อสักครู่"; `< 60m` "N นาทีที่แล้ว"; `< 24h` "N ชั่วโมงที่แล้ว"; else "N วันที่แล้ว"; invalid/null → "ยังไม่ระบุ"

- [ ] **Step 3: test `owner-line`**

```ts
import { formatOwnerLine } from "./owner-line";
expect(formatOwnerLine({ name: "สมชาย", roleKey: "dispatcher", at: "2026-09-08T11:55:00Z", now: NOW }))
  .toBe("สมชาย · ผู้จ่ายงาน · 5 นาทีที่แล้ว");
expect(formatOwnerLine({ name: null })).toBe("ยังไม่ระบุผู้รับผิดชอบ");
```

- [ ] **Step 4: implement** — join `[name, roleLabelTh(roleKey) ถ้ามี, formatRelativeTh(at) ถ้ามี]` ด้วย " · "; `!name` → "ยังไม่ระบุผู้รับผิดชอบ"

- [ ] **Step 5: verify + commit** `feat(ui): relative-time + owner-line pure helpers`

---

## Task 24 — `<OwnerTag>` + `<ContactStrip>`

**Files:** Create `apps/web/components/ui/owner-tag.tsx`, `apps/web/components/ui/contact-strip.tsx`; Modify `apps/web/components/mission-control/exception-list.tsx`, `apps/web/components/assignments/assignment-summary-card.tsx`

- [ ] **Step 1: `<OwnerTag>`** (server component ok) — `{ name?: string | null; roleKey?: string | null; at?: string | null; className? }` → `<p class="meta-text">` icon `UserRound` + `formatOwnerLine(...)`. ถ้าไม่มี name → tone จาง + icon `UserRoundX`

- [ ] **Step 2: `<ContactStrip>`** (client — ปุ่ม `tel:` / `sms:`) — `{ contacts: Array<{ role: string; name: string; phone?: string | null }>; title? }` → แถวการ์ดเล็ก แต่ละคน: role label (`roleLabelTh` หรือ raw ถ้าไม่ match) · ชื่อ · ปุ่ม `โทร` (`tel:`) + `ข้อความ` (`sms:`) ถ้ามี phone; ไม่มี phone → "ไม่มีเบอร์ติดต่อ" จาง. Empty → ไม่ render

- [ ] **Step 3: wire `exception-list`** — แต่ละ exception row เพิ่ม `<OwnerTag>` (owner จาก event/assignment ถ้ามี field; ถ้าไม่มีก็ `name={null}`)

- [ ] **Step 4: wire `assignment-summary-card`** — เพิ่ม `<OwnerTag>` ใต้หัวการ์ด

- [ ] **Step 5: verify + commit** `feat(ui): OwnerTag + ContactStrip; wire into exception list + assignment card`

---

## Task 25 — `<ConflictWarning>` + describeAssignmentConflicts + wire create form

**Files:** Modify `apps/web/lib/domain/assignment-rules.ts` + `__tests__/assignment-rules.test.ts`; Create `apps/web/components/ui/conflict-warning.tsx`; Modify `apps/web/components/assignments/create-assignment-form.tsx`

- [ ] **Step 1: test `describeAssignmentConflicts`**

```ts
const existing = [{ startTime: "2026-09-08T09:00:00Z", endTime: "2026-09-08T11:00:00Z", label: "MOVE-1" }];
const out = describeAssignmentConflicts({ startTime: "2026-09-08T10:00:00Z", endTime: "2026-09-08T12:00:00Z" }, existing);
expect(out).toEqual(["ทับซ้อนกับงาน MOVE-1 (09:00–11:00)"]);
// ไม่ทับ → []
```

- [ ] **Step 2: implement** `describeAssignmentConflicts(candidate: TimeRangeInput, existing: Array<AssignmentWindow & { label?: string }>): string[]` — สำหรับแต่ละ existing ที่ `hasAssignmentTimeConflict(candidate, [e])` → push `ทับซ้อนกับงาน <label ?? "อื่น"> (<HH:MM>–<HH:MM>)`

- [ ] **Step 3: `<ConflictWarning>`** (server ok) — `{ conflicts: string[]; className? }` → ถ้า empty ไม่ render; else กล่องแดง (`border-rose-200 bg-rose-50 text-rose-700`) icon `TriangleAlert` + หัวข้อ "ตรวจพบการจองซ้อนเวลา" + `<ul>` conflicts + ข้อความ "ต้องระบุเหตุผลถ้าจะจองต่อ"

- [ ] **Step 4: wire `create-assignment-form`** (client) — เมื่อเลือก driver/vehicle + กรอกเวลา → เรียก `describeAssignmentConflicts` กับ assignment ที่มีอยู่ของ driver/vehicle นั้น (prop `existingByDriver` / `existingByVehicle` ที่ page ส่งมา) → แสดง `<ConflictWarning>`; ปุ่ม submit ต้องมี `reason` ถ้ามี conflict (textarea "เหตุผลการจองซ้อน" แสดงเมื่อ conflict)

- [ ] **Step 5: verify + commit** `feat(assignments): inline conflict warning when double-booking driver/vehicle`

---

## Task 26 — `<NotificationCard>` + wire driver notification console

**Files:** Create `apps/web/components/ui/notification-card.tsx`; Modify `apps/web/components/mission-control/driver-notification-console.tsx`

- [ ] **Step 1: `<NotificationCard>`** — `{ title: string; body?: string; tone?: "info" | "warning" | "critical"; at?: string | null; actionHref?: string; actionLabel?: string }` → `.smart-card` แถบสีตาม tone ซ้าย, `formatRelativeTh(at)` มุมขวา, ปุ่ม action ถ้ามี `actionHref`

- [ ] **Step 2: wire** — `driver-notification-console` แทน markup แจ้งเตือน raw ด้วย `<NotificationCard>` (title = ประเภท, body = ข้อความ, at = created_at, tone จาก severity)

- [ ] **Step 3: verify + commit** `feat(ui): NotificationCard; use in driver notification console`

---

## Task 27 — `/portal` read-only workspace

**Files:** Create `apps/web/app/portal/layout.tsx`, `apps/web/app/portal/page.tsx`, `apps/web/components/portal/portal-project-card.tsx`, `apps/web/components/portal/portal-mission-status.tsx`

- [ ] **Step 1: `layout.tsx`** — `getViewerAccess()` → ต้องมี role `organizer` | `customer_viewer` | `super_admin` มิฉะนั้น `<AccessDenied requiredRole="ผู้จัดงาน / ฝั่งลูกค้า" />`. Wrap ด้วย `<PageHeader eyebrow="พื้นที่ผู้จัดงาน" title="ภาพรวมโครงการ" />` + children

- [ ] **Step 2: `page.tsx`** — `getProjects()` (scoped) + สำหรับแต่ละ project `getMissionsByProjectId` → render `<PortalProjectCard>` (ชื่อ/รหัส/lifecycle badge + จำนวน mission ตามสถานะ) + `<PortalMissionStatus>` (list mission + `formatStatusTh`). **ไม่เรียก** `getLatestDriverLocations` / resources — organizer ไม่เห็น GPS/คนขับ. ท้ายหน้า `<ChangeRequestForm projectId={...} />` (เลือกโครงการแรก) + `<EmptyState>` ถ้าไม่มีโครงการ

- [ ] **Step 3: `<PortalProjectCard>` / `<PortalMissionStatus>`** — read-only, `.smart-card`, ไม่มีปุ่มแก้

- [ ] **Step 4: verify** typecheck + lint + test + `curl /portal` (dev fallback = super_admin → 200); build

- [ ] **Step 5: commit** `feat(portal): organizer/customer read-only workspace with change request`

---

## Task 28 — home `/` section-by-permission

**Files:** Modify `apps/web/app/page.tsx`

- [ ] **Step 1:** `getViewerAccess()` ต้นหน้า → `const can = (p: string) => permissions.includes("*") || permissions.includes(p)`

- [ ] **Step 2:** เงื่อนไข render:
  - `<OperationsHero>` — เสมอ
  - `<OperationsPulse>` / `<TodayOperationBoard>` — `can("assignment.read")`
  - GPS ใน hero/pulse (`gpsCount`, `riskCount`) — คำนวณเฉพาะเมื่อ `can("driver.read")` มิฉะนั้น 0 + ซ่อน `<ReadinessOverview>` GPS line
  - `<ReadinessOverview>` — `can("project.read")`
  - `<QuickActionPanel>` — เสมอ (ปุ่มมันกรอง permission เองได้ทีหลัง)
  - `<PilotProgressPanel>` — เฉพาะ `roleKeys.includes("super_admin")`
  - ถ้าไม่มี permission อะไรเลย → `<EmptyState title="ยังไม่มีพื้นที่ทำงานที่กำหนด" description="ติดต่อผู้ดูแลเพื่อรับบทบาท" />`

- [ ] **Step 3:** อย่าเรียก `getLatestDriverLocations` ถ้า `!can("driver.read")` (ประหยัด query + ไม่รั่ว)

- [ ] **Step 4: verify** typecheck + lint + test + build + screenshot `/`

- [ ] **Step 5: commit** `feat(home): render dashboard sections by permission`

---

## Task 29 — regression + handoff

- [ ] **Step 1:** typecheck + lint + test + build เขียว
- [ ] **Step 2:** screenshot `/`, `/portal`, `/assignments`, `/mission-control` — ไม่มี overflow, primitive ใหม่แสดงถูก
- [ ] **Step 3:** handoff `930-rbac-phase-4-done.md` + อัปเดต `922` → "Phase 0-4 ✅"
- [ ] **Step 4:** commit `docs: Phase 4 done`

---

## เลื่อนไป Phase 4b / 5 (ไม่ทำใน plan นี้)

- Task 30 (dispatch fluency: bulk assign, keyboard `j/k/a//`, inline edit + `<SavePanel>`, saved filter) — งานลึก, แยก plan
- Task 31 (`<UndoToast>` + optimistic update + rollback ทุก action) — ต้องแก้ทุก action, แยก plan
- `<ReadinessGate>` / `<ConfirmImpactDialog>` ก่อน publish — publish flow มี `publish-readiness-panel` + `change-impact-summary` อยู่แล้ว; ยกระดับเป็น hard-gate ใน Phase 4b
- `<ChangeRequestButton>` แทนปุ่มแก้หลัง publish — ต้อง audit ทุกปุ่มแก้, Phase 4b

## Self-review

- `formatOwnerLine` / `formatRelativeTh` เป็น pure — ไม่ import server-only, test ได้ใน node env
- `<ContactStrip>` / `<ConflictWarning>` interactive parts เป็น client; `<OwnerTag>` / `<NotificationCard>` server ได้
- `/portal` layout gate ใช้ pattern เดียวกับ `/superadmin/layout.tsx` (getViewerAccess + AccessDenied)
- Type: `describeAssignmentConflicts` รับ `TimeRangeInput` (มี field `startTime`/`endTime` string) — ตรงกับ signature เดิมในไฟล์
