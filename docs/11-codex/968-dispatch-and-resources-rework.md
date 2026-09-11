# 968 — Dispatch and resources rework

Handoff note. This session rebuilt how a project is staffed and how work is
planned onto it, on top of the Call Sign restructure from `967`. Read `967`
first for why the Call Sign is the crewed unit; this covers what was built and
what is still open.

**Nothing here is deployed.** It is committed on `main` locally and verified,
but the owner asked to review on localhost before production. See *Deploying*
below.

---

## The shape it settled into

A project is staffed from its own list, work is set up in one card, and the
result is a unit that carries its own credentials and its own jobs.

```
ทรัพยากรกลาง (/resources)        the library — people and vehicles kept between events
   ↓ import (a copy, not a reference)
ทรัพยากรของโครงการ               this project's own list
   ↓
จัดงาน  ขั้นที่ 1                 crew a unit + its mission → QR issued immediately
        ขั้นที่ 2                 open work onto a unit
        หน่วยรถ                   one card per unit: details, QR, its jobs in time order
   ↓
ศูนย์ควบคุม                       where everything stands
```

---

## Decisions worth not re-litigating

**Project resources are copies, not references.** `drivers.project_id` /
`vehicles.project_id` null means the library; set means a project's own copy
(migration `0035`). Copies because `status` is a single column — a shared row
marked `assigned` on last week's event reads as busy on this week's. Importing
resets the copy to `available`.

**Every unit has its own mission, typed fresh.** The owner asked for this twice
and explicitly rejected reusing a mission across units. That makes unit ↔ mission
one-to-one, which is *why* opening work only asks for the unit — the mission
comes from `call_signs.metadata.missionId`. If anyone re-adds a mission picker to
the job form, they have re-introduced a way to answer the same question twice
and contradict it.

**Missions own days, jobs own the clock.** A mission carries
`metadata.operationStartDate` / `operationEndDate`; a job picks a time inside
that window, and a day too when the mission spans several. This is what stopped
the two from contradicting each other.

**Deleting a unit that has ever held work archives it instead.**
`assignments.call_sign_id` is `ON DELETE RESTRICT`, so even a *cancelled* job
blocks a delete. A unit with no work at all is deleted for real; one with history
is retired (`status = 'archived'`) and says so. Its QR and observer link are
revoked first either way.

**The status board is a filter, not a kanban.** Eight lanes needed a sideways
scroll, and the states past the fold were the late ones. It now lives in
ศูนย์ควบคุม as chips-with-counts over one list, sorted soonest-first.

---

## Traps that already bit once

- **`next start` does not read the repo-root `.env.local`.** It runs inside
  `apps/web` and reads only that directory, and the middleware is on the Edge
  runtime with no filesystem fallback — so every request bounces to
  `/login?reason=missing-auth-config`. Use `node scripts/start-local-check.mjs`,
  which exports the root file into the process first.
- **A guard written against a manual flow blocks everything once that flow is
  automatic.** The unit delete refused while a live QR existed, which was fine
  when QRs were issued by hand — then QRs became automatic at crew time and the
  guard refused every unit, including the one just created by mistake.
- **A count that hides rows will contradict a guard that does not.** The unit
  card showed "0 งาน" while cancelled jobs blocked the delete. Card now shows
  `0 งาน · ยกเลิก 2`.
- **`isBackwards`/`describeDuration` must anchor a bare `HH:MM` to a day** before
  comparing, or a time-only range never parses and always answers "fine".
  Covered by `datetime-display.test.ts`.
- **Do not reach for the purge tool to get a clean slate.** The owner's own test
  project is tagged `smokeTest`, which is what it keys on.

---

## What is still open

**Needs the owner**

- Review on localhost, then deploy (see below).
- Rotate the FCM key — it went through a chat transcript (`966`).
- Decide whether `google-services.json` stays in git (`966`).
- `DRIVER_ACCESS_TOKEN_SECRET` differs between Vercel and `.env.local`, so a
  locally seeded QR never opens on production (`966`). Vercel marks it sensitive,
  so `vercel env pull` returns it empty — it cannot be read back, only re-set.

**Needs building**

- Physical-device testing has not resumed since the mobile work in `965`.
- The reminder-before-next-job feature is still parked, with a settable lead
  time rather than a fixed ten minutes (`966`).

**Deliberately not done**

- Mission reuse across units — see the decision above.
- Anything in `967`'s "Still remaining" that depends on a pilot.

---

### Closed since this note was written

- The empty project resource list now explains itself, and says whether the
  library has anything to import.
- `/resources/drivers` and its readiness table are gone. The table showed name,
  phone and ready-or-not, all of which the project resource list already shows;
  the one thing it added — flagging a driver with no phone — moved onto the row
  itself, where the record is.
- `/resources/vehicle` (singular) is deleted. The legacy rewrite it existed for
  went with the move to `apps/web/vercel.json`, so `[vehicleId]` resolves
  natively and the redirect only cost a round trip per vehicle opened.

## Verifying

`npm run lint && npm test && npm run build` — all green at the time of writing
(182 tests). Migrations `0031`–`0035` are applied on production.

`scripts/verify-device-rebinding.mjs` (20 checks) still passes and is the
end-to-end guard on the driver credential flow; point it at a seeded job only, as
it clears the token's binding and cooldown before it starts.

## Deploying

`git push origin main` deploys to production through Vercel. The work is
committed and verified but **deliberately unpushed** — the owner was reviewing on
localhost and asked to hold. Confirm with them before pushing rather than
assuming this note is permission.
