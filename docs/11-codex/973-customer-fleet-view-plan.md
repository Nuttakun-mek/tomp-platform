# 973 — Plan: the customer fleet view, and the first bilingual page

> **Folded into `976`, which is the single handoff note.** Kept for history —
> nothing here is required reading. Anything still live was moved, not summarised.

An executable plan. Written 2026-09-11 against `1f0b33f`; every file path, column
and function named here was checked to exist (or checked not to).

**Goal.** A customer opens a QR, enters a PIN, and sees every vehicle in their
project moving on a map — in Thai or English, with no account, and with no way
to change anything.

**Why a new page rather than permission on ศูนย์ควบคุม.** Mission Control carries
park, cancel, send-message, driver names and phone numbers. Handing a customer
that page and hiding the dangerous parts means every feature added to it later is
exposed by default until somebody remembers to hide it, and one permission bug is
a customer cancelling a job. A page that imports no action cannot mutate anything
— it is safe by construction rather than by vigilance. It also needs an account,
which a customer with a QR does not have, and it is *more* translation work: ~140
strings of operator vocabulary a customer neither needs nor understands.

**Why this page is also the right first bilingual surface.** It is new, it is
small (~40 strings), and unlike the operator screens it genuinely needs English.
Building it dictionary-first proves the i18n structure before anyone touches the
1,142 existing Thai literals (`972`).

---

## Decisions already made

These were settled with the owner. Do not reopen them.

- The observer link is stored in plaintext; the driver token stays hash-only
  (`0036`, shipped in `1f0b33f`).
- The driver sheet warns that the driver QR and PIN are shown once and must be
  saved or printed immediately.

## Assumptions — flag these to the owner, build on them meanwhile

The owner asked for the plan before answering three questions. These are the
defaults; each is one line to change, and each is marked in the tasks below.

1. **The PIN is optional per link.** An ordinary shuttle overview does not need
   one; a VIP movement does. The operator chooses at issue time.
2. **A link covers the whole project by default,** with an optional subset of
   call signs for when one project serves several customers.
3. **Driver names are hidden by default, phone numbers never shown.** A customer
   who needs to reach a driver goes through the control room. `show_crew` turns
   names on per link. Showing twenty drivers' names and numbers to every customer
   in a shared project is not a default anyone would choose deliberately.

## Global constraints

- **Read-only by construction.** The page and its components must import no
  server action and no mutating helper. A test asserts this.
- **Never render:** driver phone numbers, PINs, driver tokens, QR images,
  messages between control and drivers, incident or risk notes, timeline events,
  passenger names, or any control.
- Thai is the default locale. English is a display layer.
- Do not translate database enums, permission keys, role keys, or column names.
- Keep the operational English: TOMP, Call Sign, QR, GPS, Google Maps.
- Choosing a language must not write a timeline event.
- Issuing or revoking a customer link **must** write one
  (`TIMELINE_EVENTS.OBSERVER_ACCESS_TOKEN_CREATED` / `_REVOKED` already exist).

---

## File structure

**Create**

| Path | Responsibility |
|---|---|
| `database/migrations/0037_project_observer_links.sql` | project-scope tokens, optional PIN, attempt log |
| `apps/web/app/fleet/[token]/page.tsx` | server route: resolve token → PIN gate or view |
| `apps/web/components/fleet-view/fleet-pin-gate.tsx` | PIN entry (client) |
| `apps/web/components/fleet-view/fleet-view.tsx` | the customer view (client) |
| `apps/web/components/fleet-view/fleet-legend.tsx` | map legend, generated from freshness states |
| `apps/web/app/actions/fleet-pin.ts` | the one action this feature has: verify a PIN |
| `apps/web/lib/data/fleet-view.ts` | `getFleetViewByToken()` — the read |
| `apps/web/lib/i18n/keys.ts` | derived `I18nKey` (see Task 1) |
| `apps/web/lib/fleet-access/pin-rate-limit.ts` | the rate-limit rule, where it can be tested |
| `apps/web/lib/auth/public-paths.ts` | `PUBLIC_PREFIXES` + `isPublicPath`, moved out of middleware |
| `apps/web/lib/data/fleet-view.test.ts` | redaction and scope tests |
| `apps/web/lib/fleet-access/pin-rate-limit.test.ts` | rate-limit tests |
| `apps/web/lib/fleet-access/no-actions.test.ts` | the read-only guard |

**Modify**

| Path | Change |
|---|---|
| `apps/web/lib/i18n/index.ts` | derive the key union; loud missing key in dev |
| `apps/web/lib/i18n/en.ts` | type as `typeof th` |
| `apps/web/lib/i18n/th.ts`, `en.ts` | add the `fleet.*` namespace |
| `apps/web/lib/domain/gps-freshness.ts` | add `gpsFreshnessLabel(freshness, locale)` |
| `apps/web/lib/driver-access/token.ts` | observer PIN helpers + cookie prefix |
| `apps/web/app/actions/observer-access.ts` | issue project-scope links |
| `apps/web/components/assignments/call-sign-access-panel.tsx` | issue/show the project link |
| `apps/web/middleware.ts` | import `isPublicPath` from lib; add `/fleet` and `/track` |
| `scripts/production-smoke.mjs` | cover `/fleet` and `/track` |

---

## Task 1 — Make the dictionary hold its shape

Nothing else in this plan is safe without it: a page built on a 23-entry
hand-written key union starts rotting the moment the union stops being updated.

- [ ] **Step 1: the failing test.** `apps/web/lib/i18n/i18n.test.ts`:

```ts
it("falls back to Thai for an unknown key but marks it in development", () => {
  const previous = process.env.NODE_ENV;
  (process.env as Record<string, string>).NODE_ENV = "development";
  expect(t("th", "fleet.doesNotExist" as I18nKey)).toBe("⟦fleet.doesNotExist⟧");
  (process.env as Record<string, string>).NODE_ENV = previous ?? "test";
});
```

- [ ] **Step 2: run it, confirm it fails** — `npm test -w @tomp/web -- i18n`.

- [ ] **Step 3: derive the key type** in `apps/web/lib/i18n/index.ts`, replacing
      the hand-written `I18nKey` union entirely:

```ts
type DeepKeys<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${DeepKeys<T[K]>}`;
}[keyof T & string];

export type I18nKey = DeepKeys<typeof th>;
```

Move it to `apps/web/lib/i18n/keys.ts` if the import cycle bites; `index.ts`
re-exports it either way.

- [ ] **Step 4: make a missing English string a compile error.** In `en.ts`,
      change `export const en = {` to `export const en: typeof th = {`. Fix
      whatever this reveals — that is the point of it.

- [ ] **Step 5: make a missing key visible.** In `t()`:

```ts
  if (typeof value === "string") return value;
  return process.env.NODE_ENV === "production" ? key : `⟦${key}⟧`;
```

- [ ] **Step 6:** `npm run typecheck && npm test -w @tomp/web` — green.
- [ ] **Step 7: commit** — `i18n: derive the key type and stop losing translations quietly`.

## Task 2 — Bilingual GPS state labels

The customer is the person most likely to see a blue dot and not know what it
means, and `gpsFreshnessLabelTh` is Thai-only. This also closes finding 5 of
`971` for both audiences.

**Produces:** `gpsFreshnessLabel(freshness: GpsFreshness, locale: LocaleCode): string`

- [ ] **Step 1: the failing test** in `apps/web/lib/domain/gps-freshness.test.ts` (it exists — add to it):

```ts
it("labels every state in both languages", () => {
  const states: GpsFreshness[] = ["live", "idle", "slow", "offline", "stopped"];
  for (const state of states) {
    expect(gpsFreshnessLabel(state, "th")).toBe(gpsFreshnessLabelTh(state));
    expect(gpsFreshnessLabel(state, "en")).toMatch(/^[\x20-\x7E]+$/);
  }
});
```

- [ ] **Step 2: run it, confirm it fails.**
- [ ] **Step 3: implement** in `apps/web/lib/domain/gps-freshness.ts`. Keep
      `gpsFreshnessLabelTh` — it has existing callers — and have it delegate.
      English: `Live`, `Parked`, `Slow signal`, `No update`, `Sharing off`.
- [ ] **Step 4: run, green. Step 5: commit.**

## Task 3 — Migration 0037

- [ ] **Step 1: write** `database/migrations/0037_project_observer_links.sql`:

```sql
-- An observer link could only ever point at one crewed unit. A customer watching
-- their own movement needs the project, not a vehicle — and handing them one
-- link per vehicle is not a workaround, it is twenty QR codes.
--
-- call_sign_id becomes nullable and `scope` says which kind of link this is, so
-- the shape is checked by the database rather than remembered by the reader.

alter table public.observer_access_tokens
  alter column call_sign_id drop not null;

alter table public.observer_access_tokens
  add column if not exists scope text not null default 'call_sign',
  add column if not exists pin_hash text,
  add column if not exists call_sign_ids uuid[],
  add column if not exists show_crew boolean not null default false,
  add column if not exists label text;

alter table public.observer_access_tokens
  drop constraint if exists observer_access_tokens_scope_check;
alter table public.observer_access_tokens
  add constraint observer_access_tokens_scope_check
  check (scope in ('call_sign', 'project'));

-- A call-sign link names its unit; a project link must not, or the reader has
-- two sources of truth for what the link covers.
alter table public.observer_access_tokens
  drop constraint if exists observer_access_tokens_scope_shape;
alter table public.observer_access_tokens
  add constraint observer_access_tokens_scope_shape check (
    (scope = 'call_sign' and call_sign_id is not null)
    or (scope = 'project' and call_sign_id is null)
  );

comment on column public.observer_access_tokens.call_sign_ids is
  'Project-scope only: the units this link may see. NULL means every unit in the project.';
comment on column public.observer_access_tokens.show_crew is
  'Whether driver names appear. Phone numbers never appear regardless.';

-- Wrong PINs are counted per link *and per client*, never per link alone:
-- locking the link itself would let anyone shut a customer out by guessing badly
-- on purpose.
create table if not exists public.observer_pin_attempts (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.observer_access_tokens(id) on delete cascade,
  client_fingerprint text not null,
  succeeded boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index if not exists observer_pin_attempts_lookup_idx
  on public.observer_pin_attempts(token_id, client_fingerprint, attempted_at desc);

alter table public.observer_pin_attempts enable row level security;
revoke all on public.observer_pin_attempts from anon, authenticated;
```

- [ ] **Step 2:** `node scripts/apply-migrations.mjs --dry-run` shows `0037` pending.
- [ ] **Step 3:** apply — `node scripts/apply-migrations.mjs --yes`. **Ask the
      owner first**; writing to the production database is gated.
- [ ] **Step 4:** mirror with `scripts/sync-supabase-migrations.mjs`.
- [ ] **Step 5: commit.**

## Task 4 — Observer PIN helpers

**Produces:** `generateObserverPin()`, `hashObserverPin(pin)`,
`verifyObserverPin(pin, hash)`, `OBSERVER_PIN_COOKIE_PREFIX`.

The driver equivalents in `apps/web/lib/driver-access/token.ts` are the pattern —
`generateDriverPin` / `hashDriverPin` / `verifyDriverPin` at lines 60–81. Reuse
the hashing, do **not** reuse the cookie prefix: `dpin_` unlocks a driver's job
and these two must never be confused.

- [ ] **Step 1:** test in `apps/web/lib/driver-access/__tests__/token.test.ts` —
      a generated PIN is six digits, verifies against its own hash, fails against
      another's, and `verifyObserverPin("", hash)` is false.
- [ ] **Step 2: run, fails. Step 3: implement. Step 4: run, green. Step 5: commit.**

## Task 5 — The read

**Produces:**

```ts
export interface FleetViewUnit {
  callSignId: string;
  callSign: string;
  vehicle: { plateNumber: string; vehicleType: string; colour: string | null; capacity: number | null } | null;
  driverName: string | null;          // null unless the link sets show_crew
  latitude: number | null;
  longitude: number | null;
  recordedAt: string | null;
  freshness: GpsFreshness;
  destination: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface FleetView {
  tokenId: string;
  project: { name: string; code: string };
  requiresPin: boolean;
  units: FleetViewUnit[];
}

export async function getFleetViewByToken(token: string): Promise<FleetView | null>;
```

Notes that matter:

- Resolve with `hashObserverAccessToken(token)` and require `status = 'active'`
  and an unexpired `expires_at`, exactly as `getObserverAccessView` does.
- `scope` must be `'project'`; a call-sign token returns `null` here and belongs
  on `/track`.
- Units come from `getCallSignsByProjectId`, filtered by `call_sign_ids` when it
  is not null.
- Positions: the existing `getLatestDriverLocationsByProjectId` returns
  `DriverLocation[]`, which **has no `callSignId`** in the domain type even
  though `gps_locations.call_sign_id` exists. Add
  `getLatestLocationsByCallSign(projectId): Promise<Record<string, {latitude, longitude, recordedAt, sharingEvent, metadata}>>`
  to `apps/web/lib/data/locations.ts` rather than widening the shared type.
- Freshness via `gpsFreshness(recordedAt, sharingEvent, Date.now(), metadata)` —
  pass the metadata, or every parked vehicle reads as offline to the customer.
- `destination` comes from the assignment's `metadata.dropoffLocation`, the same
  way `routeMeta` reads it in `lib/data/observer-access.ts`.
- **`driverName` is `null` unless `show_crew`. Phone is never selected at all** —
  not selected-then-dropped, so it cannot leak through a later refactor.

- [ ] **Step 1: the failing tests** in `apps/web/lib/data/fleet-view.test.ts`:
      a project token returns every unit; `call_sign_ids` restricts it; a call-sign
      token returns null; an expired token returns null; `show_crew = false`
      yields `driverName === null`; no returned object has a `phone` key at any
      depth.
- [ ] **Step 2: run, fails. Step 3: implement. Step 4: run, green. Step 5: commit.**

## Task 6 — The PIN gate

**Produces:** `verifyFleetPinAction({ token, pin })` in
`apps/web/app/actions/fleet-pin.ts` → `ActionResult`.

Rules:

- No PIN on the link (`pin_hash` null) → the page renders straight away.
- On success, set `` `${OBSERVER_PIN_COOKIE_PREFIX}${tokenId}` `` — httpOnly,
  sameSite lax, secure, 12 hours — and log the attempt with `succeeded = true`.
- On failure, log it and return a Thai/English message by **code**, not text:
  `{ code: "fleet.pin.wrong" }`, resolved in the component. This is the message-
  code pattern `972` asks for; this action is where it starts.
- **Rate limit:** more than **10 failures in 15 minutes for the same
  `(token_id, client_fingerprint)`** returns `{ code: "fleet.pin.tooMany" }`.
  `client_fingerprint` = SHA-256 of the request IP plus the User-Agent (see
  `hashDriverDeviceId` for the hashing shape). **Never revoke or disable the
  token on failed attempts** — that is a denial of service against the customer,
  handed to anyone who has seen the QR.
- Deliberately unlike the driver's 15-minute lockout: a driver is one known
  person on one phone, a customer link may be open on forty devices at once.

**Where the logic goes, and why it is not in the action.** `apps/web/vitest.config.ts`
includes **`lib/**/*.test.ts` and nothing else** — a test written under `app/` or
`components/` is silently never run, which is worse than no test. So the rule
lives in `apps/web/lib/fleet-access/pin-rate-limit.ts` as a pure function and the
action stays a thin wrapper around it:

```ts
export const FLEET_PIN_MAX_FAILURES = 10;
export const FLEET_PIN_WINDOW_MS = 15 * 60 * 1000;

/** Attempts are the failures already recorded for this (token, client) pair. */
export function isFleetPinRateLimited(recentFailureTimes: number[], now = Date.now()): boolean {
  return recentFailureTimes.filter((at) => now - at < FLEET_PIN_WINDOW_MS).length >= FLEET_PIN_MAX_FAILURES;
}

export function fleetClientFingerprint(ip: string, userAgent: string): string;
```

- [ ] **Step 1: the failing tests** in `apps/web/lib/fleet-access/pin-rate-limit.test.ts`:
      nine failures inside the window are not limited; ten are; failures older
      than the window do not count; two different fingerprints produce different
      values from the same PIN attempt. Then, in
      `apps/web/lib/data/fleet-view.test.ts`, that a link with no `pin_hash`
      requires no PIN.
- [ ] **Step 2: run, fails. Step 3: implement. Step 4: run, green. Step 5: commit.**

## Task 7 — Copy

- [ ] **Step 1:** add the `fleet.*` namespace to `th.ts` and `en.ts` — around 40
      keys: page title, "vehicles in this project", the five GPS states (from
      Task 2), destination, last update, "no position yet", the PIN gate prompt
      and its two error codes, the read-only badge, the legend heading.
- [ ] **Step 2:** `npm run typecheck` — with `en: typeof th` from Task 1, a
      missing English string fails here. That is the check working.
- [ ] **Step 3: commit.**

Write the Thai as literal Thai characters. `th.ts` currently uses `ระ…`
escapes, which are unreadable in review and in diffs; do not add more.

## Task 8 — The page

- [ ] **Step 1:** `apps/web/app/fleet/[token]/page.tsx` — server component:
      resolve the locale with `getRequestLocale()`, call `getFleetViewByToken`,
      render `FleetPinGate` when `requiresPin` and the cookie is absent,
      otherwise `FleetView`. A `null` view renders the same shape as the existing
      `/track` failure page: expired / revoked / no access, contact the control
      room. No stack traces, and **no hint about whether the token merely
      expired** — a wrong token and an expired one look identical.
- [ ] **Step 2:** `fleet-view.tsx` — header (project name, read-only badge,
      `LanguageSwitcher`), `LiveTrackingMap` with one `TrackedPoint` per unit,
      `FleetLegend`, then one card per unit: call sign, plate, type, colour,
      status label, last-update time, destination. Cards sorted by call sign so
      the order does not jump as positions change.
- [ ] **Step 3:** `fleet-legend.tsx` — generate the rows from the five
      `GpsFreshness` values and the `COLOR` map in `live-tracking-map.tsx`; export
      that map rather than copying the hex values, so a new state cannot appear on
      the map without appearing in the legend.
- [ ] **Step 4:** `fleet-pin-gate.tsx` — six-digit entry, resolves the two error
      codes through the dictionary. `apps/web/components/driver/driver-pin-gate.tsx`
      is the working pattern.
- [ ] **Step 5:** refresh. Poll `router.refresh()` on a 30-second interval, and
      **stop polling when the tab is hidden** (`document.visibilityState`) —
      a customer leaves this open for hours on a phone.
- [ ] **Step 6:** the read-only guard, in `apps/web/lib/fleet-access/no-actions.test.ts`
      — under `lib/` because that is the only directory vitest collects. It reads
      every file in `components/fleet-view/` and `app/fleet/` off disk and fails
      on any import from `@/app/actions/` other than `fleet-pin`:

```ts
const files = [...walk("components/fleet-view"), ...walk("app/fleet")];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const imports = [...source.matchAll(/from "@\/app\/actions\/([\w-]+)"/g)].map((m) => m[1]);
  expect(imports.filter((name) => name !== "fleet-pin")).toEqual([]);
}
```
- [ ] **Step 7:** `npm run lint && npm test && npm run build`. **Step 8: commit.**

## Task 9 — Issuing the link

- [ ] **Step 1:** extend `createObserverAccessTokenAction` with
      `{ scope?: "call_sign" | "project"; callSignIds?: string[]; withPin?: boolean; showCrew?: boolean; label?: string }`.
      Keep the default `scope: "call_sign"` so every existing caller is unchanged.
      When `withPin`, generate a PIN, store `pin_hash`, and **return the plaintext
      once** — like the driver PIN, it is never readable again.
- [ ] **Step 2:** the idempotency added in `1f0b33f` (an ordinary press returns
      the live link) applies per scope: a project link and a unit's link are
      different rows and must not cancel each other. Match on `scope` when
      looking for the existing token.
- [ ] **Step 3:** expiry. `getDefaultDriverTokenExpiry(12)` is twelve hours,
      which is wrong for a customer watching a multi-day project. Default a
      project link to **the project's `end_date` plus 24 hours**, falling back to
      30 days when the project has no end date.
- [ ] **Step 4:** UI on `จัดงาน` — a card above the unit list: "link for the
      customer", with the optional PIN, the optional unit subset, the driver-name
      toggle, the QR, and the same save-or-lose warning the driver sheet now
      carries (the PIN is shown once; the link itself is redrawable).
- [ ] **Step 5:** tests for the action: project scope stores no `call_sign_id`;
      the shape constraint rejects a bad combination; `withPin` returns a PIN
      exactly once. **Step 6: commit.**

## Task 10 — Make the public routes public on purpose

`/track` is reachable today without a login, but **by accident**: `PUBLIC_PREFIXES`
in `apps/web/middleware.ts` does not contain it, and the request survives only
because `supabase.auth.getUser()` returns an *error* for a browser with no cookie
at all, and the guard bounces only when it returns a null user with no error. A
customer whose browser holds a stale TOMP cookie can take the other branch and be
redirected to a login page they have no account for.

`middleware.ts` also sits outside vitest's `lib/**` include and runs on the Edge
runtime, so the decision moves to a module that can be tested.

- [ ] **Step 1:** move `PUBLIC_PREFIXES` and `isPublicPath` into
      `apps/web/lib/auth/public-paths.ts` and import them in `middleware.ts`.
      Pure string work, no Next or Supabase imports, so the Edge bundle is
      unaffected.
- [ ] **Step 2: the failing test** in `apps/web/lib/auth/public-paths.test.ts`:
      `/fleet/abc` and `/track/abc` are public; `/projects` and `/fleetwise` are
      not (the second catches a prefix match that forgets the boundary).
- [ ] **Step 3:** add `"/fleet"` and `"/track"` to `PUBLIC_PREFIXES`.
- [ ] **Step 4:** add both to `scripts/production-smoke.mjs`, which covers
      neither today — which is why this was never caught.
- [ ] **Step 5: run, green. Step 6: commit.**

---

## Verify

```
npm run lint && npm test && npm run test:mobile && npm run build
```

**Check your tests actually ran.** `apps/web/vitest.config.ts` collects only
`lib/**/*.test.ts`. If a new test file lives anywhere else it is not failing —
it is not running. Confirm the file count in the vitest output went up.

Then, against a link issued by the deployment being tested (a locally seeded
token cannot open on production — `DRIVER_ACCESS_TOKEN_SECRET` differs, see `966`):

1. Open `/fleet/<token>` **in a private window**. A normal window hides the bug
   this feature is most likely to have: an operator session making it look
   reachable when it is not.
2. Wrong PIN eleven times → `tooMany`; then confirm from another browser that the
   link still works. If it does not, the rate limit is keyed wrongly and a
   stranger can lock a customer out.
3. Every vehicle in the project appears; a parked one reads "จอดอยู่" / "Parked"
   in blue and never turns red.
4. Switch to English. Nothing stays Thai, and nothing renders as `⟦fleet.…⟧`.
5. No driver name appears unless the link was issued with `show_crew`; no phone
   number appears under any setting. Check the page source, not just the screen.
6. `npm run smoke:production`.

## Known gap this plan does not close

`live-tracking-map.tsx` draws one marker per point at its exact coordinates, so
vehicles parked in the same yard land on the same pixel and read as one — finding
1 of `971`. It is worse here than on the operator board, because a customer
counting their fleet has no card list to check against. It is a separate piece of
work with its own decision (spiderfy versus cluster) and should not be folded into
this plan, but it should be scheduled **directly after** it.

## Deploying

`git push` does **not** deploy — the Vercel project has no Git connection. Apply
the migration first (the code writes columns that must already exist), then:

```
vercel --prod --yes
```

and confirm the build stamp moved at `/api/health`.
