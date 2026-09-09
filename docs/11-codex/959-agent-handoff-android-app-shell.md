# 959 — Agent handoff: Android Driver App Shell

วันที่จัดทำ: 2026-09-09  
เป้าหมาย: สร้าง Android App Shell สำหรับคนขับเพื่อทดสอบงานจริงก่อน iOS  
Repository: `Nuttakun-mek/tomp-platform`  
พื้นที่หลัก: `apps/mobile-driver` และจุดเชื่อมต่อ Driver Web/API ที่ระบุเท่านั้น

เอกสารนี้ต่อยอดจาก:

- `docs/11-codex/953-mobile-app-plan.md`
- `docs/11-codex/954-agent-handoff-mobile-app.md`
- `docs/08-engineering/813-driver-mobile-app-mvp.md`
- `docs/11-codex/957-system-effectiveness-audit-and-agent-plan.md`
- `docs/11-codex/958-957-execution-status.md`

หากเอกสารเดิมขัดกับสถานะโค้ดปัจจุบัน ให้ใช้เอกสารนี้เป็นแผนสำหรับ Android App Shell รอบแรก โดยเฉพาะเรื่อง Driver Session หลังการแก้ P0-2

## 1. ข้อตกลงผลิตภัณฑ์

Android รอบนี้เป็น **App Shell** ไม่ใช่การเขียน Driver UI ใหม่ทั้งชุดด้วย React Native

หน้าที่ของแต่ละส่วน:

| ส่วน | ความรับผิดชอบ |
|---|---|
| Driver Web ใน WebView | PIN, pre-flight, งานปัจจุบัน/งานถัดไป, รูปหลักฐาน, สถานะงาน, ข้อความ, แจ้งปัญหา และภาษาไทย |
| Android Native Shell | สแกน QR, deep link, SecureStore, background GPS, foreground service, offline queue, สถานะเครือข่าย และการเปิด native intent |
| TOMP Web API | ตรวจ session, ตรวจ assignment scope, validation, write transaction, Timeline และ response แบบ typed |
| Mission Control | แสดงตำแหน่งและสถานะโดยผูกกับ project, assignment, driver, vehicle และ Call Sign จาก server context |

เหตุผลที่เลือก App Shell:

1. Driver UI มีอยู่ใน Web และเปลี่ยนแปลงบ่อย การเขียน Native ซ้ำจะทำให้ flow แตกต่างกัน
2. Android Native เพิ่มเฉพาะสิ่งที่ browser ทำไม่ได้อย่างเชื่อถือได้ ได้แก่ background location และ push notification
3. การปรับ UI คนขับสามารถส่งขึ้น Web ได้ทันทีโดยไม่ต้องออก APK ทุกครั้ง
4. Shared business rules ยังคงอยู่ใน `@tomp/driver-core` และ `@tomp/types`

## 2. ขอบเขตรอบ Android แรก

ต้องมี:

1. สแกน QR หรือเปิด `tompdriver://` deep link
2. เปิด Driver Web ใน WebView
3. แสดงและตรวจ PIN ตาม flow เดียวกับ Web
4. สร้าง Mobile Driver Session หลัง PIN สำเร็จ
5. เริ่ม/หยุด GPS จากปุ่มเดียวใน Driver Web
6. ส่งตำแหน่งต่อเมื่อแอปอยู่เบื้องหลังหรือปิดหน้าจอ ภายใต้ข้อจำกัด Android
7. Android foreground-service notification ระหว่างแชร์ตำแหน่ง
8. เก็บและส่งซ้ำเมื่อเครือข่ายขาด
9. ส่งสถานะ GPS กลับไปแสดงใน WebView อย่างตรงกับสถานะจริง
10. Mission Control ระบุได้ว่าพิกัดเป็นของ project/assignment/driver/vehicle ใด
11. สร้าง EAS Preview APK สำหรับติดตั้งโดยตรง
12. ทดสอบบน Android จริงอย่างน้อยหนึ่งเครื่อง

ยังไม่ทำในรอบนี้:

- iOS build และ TestFlight
- Public Play Store
- Route optimization
- Native Driver UI เต็มรูปแบบ
- Push notification หาก GPS pilot gate ยังไม่ผ่าน
- การอ่าน/เขียน Supabase จาก Mobile โดยตรง
- Service-role key ในแอปทุกกรณี

## 3. สถานะโค้ดปัจจุบัน

มีแล้ว:

- Expo SDK 57 และ React Native
- EAS project/owner/package ID
- QR scanner ผ่าน `expo-camera`
- `tompdriver://` deep link
- token ใน SecureStore
- `TaskManager.defineTask` และ `startLocationUpdatesAsync`
- Android foreground-service notification
- foreground location และ background location
- offline queue แบบ SecureStore
- API base URL ชี้ไป TOMP Web

ยังไม่ตรงกับ App Shell:

| รายการ | สถานะปัจจุบัน |
|---|---|
| `App.tsx` | Native Driver UI เดิมประมาณ 619 บรรทัด ยังไม่ใช่ WebView shell |
| `react-native-webview` | ยังไม่ได้ประกาศเป็น dependency โดยตรง |
| Web/Native GPS bridge | ยังไม่มี |
| Mobile session หลัง PIN | ยังไม่มี |
| Mobile API auth | ยังส่ง raw QR token แต่ operational APIs ปัจจุบันต้องใช้ scoped Driver Session |
| Android config flags | `isAndroidBackgroundLocationEnabled` และ `isAndroidForegroundServiceEnabled` ยังไม่ประกาศใน plugin config |
| Queue | จำกัด 20 รายการใน SecureStore ไม่เพียงพอสำหรับ GPS หลายชั่วโมง |
| Push | ยังไม่มี `expo-notifications` |
| EAS Preview APK | ยังไม่มีหลักฐาน build/device test ที่ผ่าน |
| CI | Root quality gate ยังไม่ตรวจ mobile app |

ข้อสรุป: **ห้ามแจกแอปปัจจุบันให้คนขับทดสอบงานจริง** เพราะ session contract ไม่ตรงกับ backend และ Native UI ข้าม PIN/pre-flight บางส่วน

## 4. สถาปัตยกรรมเป้าหมาย

```text
QR / deep link
      |
      v
Android Shell ---- SecureStore (installation id + mobile session)
      |
      +---- WebView: /driver?token=<one-time QR token>
      |          |
      |          +---- PIN + pre-flight + task UI
      |          +---- postMessage(gps:start / gps:stop)
      |          +---- receive tomp:gps state
      |
      +---- Native Location Task
                 |
                 +---- Authorization: Bearer <mobile driver session>
                 +---- POST /api/driver/location
                 +---- SQLite offline queue
                                  |
                                  v
                 project + assignment + driver + vehicle resolved by server
                                  |
                                  v
                         Mission Control + Timeline
```

หลักสำคัญ:

- QR token ใช้สำหรับเริ่ม activation เท่านั้น
- ห้ามใช้ raw QR token เป็น credential ระยะยาวของ background task
- Mobile ห้ามส่ง `projectId`, `assignmentId`, `driverId`, `vehicleId` เป็นค่าที่ server เชื่อถือ
- Server ต้อง resolve scope ทั้งหมดจาก Mobile Driver Session
- WebView กับ Native Location Task ใช้ session คนละรูปแบบแต่ผูกกับ token ID/device เดียวกัน

## 5. การแยกงานจาก Agent อื่น

ห้ามทำใน working tree เดียวกับ Agent ที่กำลังแก้ Web/Database

สร้าง worktree:

```powershell
Set-Location -LiteralPath "D:\Dev-Pro\tomp-platform"
git fetch origin
git worktree add -b feature/android-driver-shell "D:\Dev-Pro\tomp-platform-android-shell" origin/main
Set-Location -LiteralPath "D:\Dev-Pro\tomp-platform-android-shell"
```

กติกาการ commit:

1. Commit A0–A2 ให้แก้เฉพาะ `apps/mobile-driver/**`
2. Rebase หลัง Agent หลักรวม security/transaction work แล้ว
3. Commit A3 จึงเพิ่ม Mobile Session API/migration
4. Commit A4 จึงแก้ Web bridge ที่ `driver-location-share.tsx`
5. ห้ามนำไฟล์ modified/untracked จาก working tree อื่นติด commit
6. ตรวจ `git diff --name-only origin/main...HEAD` ก่อน push ทุกครั้ง

## 6. Phase A0 — baseline และ dependency audit

Agent ต้องทำก่อนแก้ไฟล์:

```powershell
Set-Location apps/mobile-driver
npm.cmd ci
npm.cmd run typecheck
npx.cmd expo-doctor
npx.cmd expo config --type public
```

ตรวจยืนยัน:

- Expo account, owner และ EAS project ตรงกับ `app.json`
- ไม่มี Supabase service-role key หรือ database password ใน bundle/config
- `tompApiBaseUrl` แยก preview/staging/production ได้
- Android application ID เป็น `com.tomp.driver`
- ไม่มี `.env`, token, keystore หรือ credentials ติด Git

เพิ่ม scripts ที่จำเป็นใน `apps/mobile-driver/package.json`:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "doctor": "expo-doctor",
    "config:android": "expo config --type public",
    "start:android": "expo start --dev-client"
  }
}
```

Definition of Done:

- `npm ci`, typecheck และ Expo Doctor ผ่าน
- Agent บันทึก warning ที่ยังยอมรับได้และห้ามละเลย error

## 7. Phase A1 — Android configuration

แก้ `apps/mobile-driver/app.json`:

1. เพิ่ม Android adaptive icon/splash asset จริง หาก repository มี asset ที่อนุมัติแล้ว ห้ามสร้าง placeholder logo
2. เพิ่ม plugin flags:

```json
[
  "expo-location",
  {
    "locationAlwaysAndWhenInUsePermission": "อนุญาตให้ TOMP ใช้ตำแหน่งระหว่างปฏิบัติงาน เพื่อให้ศูนย์ควบคุมติดตามสถานะงานได้ต่อเนื่อง",
    "isAndroidBackgroundLocationEnabled": true,
    "isAndroidForegroundServiceEnabled": true
  }
]
```

3. ตรวจ permissions:

- `ACCESS_COARSE_LOCATION`
- `ACCESS_FINE_LOCATION`
- `ACCESS_BACKGROUND_LOCATION`
- `FOREGROUND_SERVICE`
- permission ของ foreground-service location ตาม Android target ที่ Expo สร้าง
- `CAMERA`

4. เพิ่ม Android version code ผ่าน EAS auto-increment หรือกำหนดให้ชัดเจน
5. เปลี่ยน app version จาก `0.1.0` เป็นรุ่น pilot ที่ตกลง เช่น `0.2.0`
6. กำหนด `scheme: tompdriver`
7. กำหนด `userInterfaceStyle`, orientation และ permission copy ภาษาไทยแบบเป็นทางการ

ยังไม่เปิด iOS background mode ใน commit Android หากไม่ได้ทดสอบ iOS แต่ห้ามลบ iOS usage descriptions เดิม

Verification:

```powershell
npx.cmd expo prebuild --platform android --clean
```

ตรวจ generated manifest ว่ามี permission และ foreground service ถูกต้อง แล้วลบ generated `android/` หาก repository ใช้ managed workflow และไม่ได้ตั้งใจ commit native project

## 8. Phase A2 — เปลี่ยนเป็น WebView App Shell

ติดตั้งด้วย Expo-compatible command:

```powershell
npx.cmd expo install react-native-webview expo-network expo-sqlite
```

โครงไฟล์เป้าหมาย:

```text
apps/mobile-driver/
  App.tsx
  src/
    components/
      AppStatusBanner.tsx
      PermissionExplainer.tsx
      ShellLoadingView.tsx
      ShellErrorView.tsx
    screens/
      ActivationScreen.tsx
      DriverShellScreen.tsx
    bridge/
      protocol.ts
      native-bridge.ts
    services/
      installation.ts
      mobile-session.ts
      location.ts
      offline-queue.ts
      network.ts
      token-store.ts
    state/
      shell-state.ts
```

`App.tsx` ต้องเหลือหน้าที่ orchestration เท่านั้น:

- restore installation/session
- receive deep link
- show activation scanner
- open DriverShellScreen
- handle app lifecycle/network lifecycle

`DriverShellScreen` ต้อง:

- ใช้ `WebView` โหลดเฉพาะ origin ที่อนุญาต
- เปิด JavaScript และ DOM storage เท่าที่จำเป็น
- เปิด shared cookie support สำหรับ PIN/session cookie
- ใช้ `onShouldStartLoadWithRequest` ปฏิเสธ navigation ที่ไม่ใช่ TOMP origin
- เปิด `tel:`, `https://www.google.com/maps/` และ `google.navigation:` ผ่าน native `Linking`
- แสดง loading/error/offline state ภาษาไทย
- รองรับ Android Back โดยย้อน WebView ก่อนปิดหน้าจอ
- เคารพ safe area และ keyboard
- ไม่ใช้ `originWhitelist={['*']}` โดยไม่มี navigation guard

หลัง Web session พร้อม ให้ WebView เรียก `history.replaceState` เพื่อล้าง token จาก address bar/history เท่าที่ flow อนุญาต

## 9. Phase A3 — Mobile Driver Session หลัง PIN

นี่เป็น **security gate** และต้องทำหลัง rebase งาน P0-2

ปัญหาปัจจุบัน:

- Driver Web ใช้ signed `HttpOnly` session cookie
- Native background `TaskManager` ไม่ควรและไม่สามารถพึ่งพา cookie ภายใน WebView
- Mobile เดิมส่ง raw QR token ไป operational API ซึ่ง backend ปัจจุบันปฏิเสธ

ห้ามแก้ด้วยการเปิดให้ raw token ใช้ API ได้อีก

### Session exchange ที่ต้องสร้าง

1. WebView ผ่าน PIN และได้ Driver Web Session ก่อน
2. WebView เรียก `POST /api/driver/mobile-session/challenge` ด้วย HttpOnly cookie
3. Server สร้าง one-time exchange code อายุไม่เกิน 60 วินาที
4. WebView ส่ง exchange code ให้ Native ผ่าน `postMessage`
5. Native ส่ง `POST /api/driver/mobile-session/exchange` พร้อม exchange code และ installation ID
6. Server ส่ง opaque mobile access token ที่มีอายุไม่เกิน assignment/QR expiry และไม่เกิน 12 ชั่วโมง
7. Native เก็บ access token ใน SecureStore
8. Operational APIs รับได้ทั้ง valid Web cookie หรือ `Authorization: Bearer <mobile-session>` ผ่าน resolver เดียว
9. การ revoke QR/token ต้อง revoke Web และ Mobile sessions ทันที
10. ห้ามส่ง token hash, service-role key หรือ signing secret กลับ client

### Persistence ที่แนะนำ

เพิ่ม forward migration หมายเลขถัดจาก migration ล่าสุดหลัง rebase ห้ามกำหนดเลขซ้ำล่วงหน้า

ตาราง `driver_mobile_sessions`:

- `id uuid primary key`
- `driver_access_token_id uuid not null`
- `project_id uuid not null`
- `assignment_id uuid not null`
- `driver_id uuid not null`
- `installation_hash text not null`
- `access_token_hash text not null unique`
- `status text not null`
- `issued_at timestamptz not null`
- `expires_at timestamptz not null`
- `last_used_at timestamptz`
- `revoked_at timestamptz`
- `metadata jsonb`

ตาราง/record สำหรับ exchange code ต้องเก็บ hash เท่านั้น, one-time, มี expiry และ consumed timestamp อาจรวมในตารางเดียวหรือ RPC ที่ atomic

RLS:

- ไม่เปิดอ่านผ่าน browser Data API
- service-role/server command เท่านั้น
- grants ต้องระบุชัดเจน
- เพิ่ม policy inventory test

Timeline events:

- mobile session established
- mobile session revoked
- background location started/stopped

อย่าสร้าง Timeline ทุก GPS ping เพราะจะทำให้ข้อมูลโตโดยไม่จำเป็น

### API resolver

ปรับ `apps/web/lib/api/driver-token.ts` หรือสร้าง `driver-session-resolver.ts`:

```ts
resolveDriverSession(request): Promise<
  | { ok: true; context: DriverSessionContext; mode: "web_cookie" | "mobile_bearer" }
  | { ok: false; status: 401 | 403; error: string }
>
```

ทุก route ต้อง resolve `projectId`, `assignmentId`, `driverId` จาก context ไม่ใช่ request body

## 10. Phase A4 — WebView/Native bridge

แก้เฉพาะจุดเชื่อม:

- `apps/web/components/driver/driver-location-share.tsx`
- สร้าง helper เช่น `apps/web/lib/driver/native-bridge.ts`
- `apps/mobile-driver/src/bridge/protocol.ts`
- `apps/mobile-driver/src/bridge/native-bridge.ts`

Protocol ต้องมี schema/runtime validation ไม่ parse แล้วเชื่อทันที

Web -> Native:

| type | payload | ความหมาย |
|---|---|---|
| `shell:ready` | version, assignmentId | Web พร้อมทำงาน |
| `session:challenge` | exchangeCode | ขอให้ Native แลก mobile session |
| `gps:start` | consentVersion | เริ่ม Native location |
| `gps:stop` | reason | หยุด Native location |
| `maps:open` | approved URL | เปิด Google Maps |
| `phone:open` | normalized phone | เปิดโทรศัพท์ |

Native -> Web:

| type | payload | ความหมาย |
|---|---|---|
| `session:ready` | expiresAt | Native session พร้อม |
| `gps:state` | off/requesting/live/slow/error | สถานะจริงของ location service |
| `gps:last-fix` | recordedAt, accuracy | เวลาพิกัดล่าสุด ไม่ส่ง secret |
| `queue:state` | pendingCount | จำนวนข้อมูลรอส่ง |
| `network:state` | online/offline | สถานะเครือข่าย |
| `permission:state` | foreground/background | สถานะ permission |

ข้อกำหนด:

- เมื่อพบ Native bridge ปุ่ม GPS ใน Web ต้องไม่เรียก `navigator.geolocation`
- Native เป็นเจ้าของ location stream เพียงรายเดียว ป้องกันพิกัดซ้ำจาก foreground watcher และ background task
- สัญญาณสีใน Web ต้องมาจากสถานะจริงของ Native ไม่เปลี่ยนเป็น live ก่อนมี location fix ที่ server รับสำเร็จ
- Native ต้องส่ง error ที่เป็นข้อความไทยแบบเป็นทางการและมีแนวทางแก้
- validate origin, message type, payload size และ allowed URL ทุกครั้ง

## 11. Phase A5 — Background GPS pipeline

ปรับ `apps/mobile-driver/src/services/location.ts`:

1. `TaskManager.defineTask` ต้องอยู่ module scope
2. ใช้ Mobile Driver Session จาก SecureStore ไม่ใช้ raw QR token
3. Request permission ตามลำดับ foreground ก่อน background
4. แสดง disclosure ก่อน Android permission dialog
5. เริ่ม foreground service เฉพาะเมื่อคนขับกดเริ่มแชร์
6. เมื่อ background task เริ่มแล้ว ให้ยุติ foreground watcher ที่ซ้ำซ้อน หรือใช้ source เดียวกัน
7. ส่ง `sharing_started` หนึ่งครั้ง, `location_ping` ตามรอบ, `sharing_stopped` หนึ่งครั้ง
8. Generate `eventId`/idempotency key ต่อ event
9. บันทึก accuracy, recordedAt, app version, platform และ mode
10. Server เป็นผู้ผูก project/assignment/driver/vehicle
11. หยุด session เมื่อคนขับกดหยุด, assignment เสร็จ, session หมดอายุ หรือถูก revoke
12. Re-check permission เมื่อแอปกลับ foreground

ค่าเริ่มต้นสำหรับ pilot:

- Accuracy: `Balanced`
- Distance interval: 25 เมตร
- Time interval: 30 วินาที
- Mission Control live: ไม่เกิน 35 วินาที
- Slow: 36–120 วินาที
- Stale/offline: มากกว่า 120 วินาที

ข้อเท็จจริงที่ UI ต้องแจ้ง:

- Android อาจหยุด background task หากผู้ใช้ Force stop แอป
- OEM บางรุ่นจำกัด background service ด้วย battery optimization
- ห้ามแสดงว่า “GPS สด” จน server ยืนยันการรับพิกัด

## 12. Phase A6 — Offline queue ที่เหมาะกับ GPS

SecureStore เหมาะกับ secret ขนาดเล็ก ไม่เหมาะเป็น queue ของ GPS ต่อเนื่อง

ย้าย queue ไป `expo-sqlite`:

ตาราง local `outbox_events`:

- `id text primary key`
- `kind text`
- `payload text`
- `created_at text`
- `attempt_count integer`
- `next_attempt_at text`
- `last_error text`
- `priority integer`

กติกา:

1. status/issue/sharing start-stop ห้ามถูกทิ้ง
2. location pings ใช้ retention จำกัดและ coalesce ได้เมื่อ offline นาน
3. ส่งตาม created order
4. exponential backoff พร้อม jitter
5. หยุด retry เมื่อ 401/403 และแสดง session expired
6. retry เมื่อ network กลับมาและเมื่อ app foreground
7. จำกัดขนาด queue พร้อมข้อมูลแจ้งเตือน ห้ามตัดเงียบ
8. ลบ event หลัง server ยืนยัน `eventId`
9. แสดง pending count ใน WebView ผ่าน bridge

## 13. Phase A7 — QR, deep link และ activation UX

ActivationScreen ต้องมี:

- ปุ่มหลัก “สแกน QR งาน”
- ช่องกรอกรหัส/ลิงก์สำรองสำหรับกรณีกล้องใช้ไม่ได้
- คำอธิบาย permission ก่อนเปิดกล้อง
- ผลสแกนที่ระบุว่า valid/expired/revoked โดยไม่เปิดเผยข้อมูลโครงการอื่น
- ปุ่มขอ QR ใหม่จากศูนย์ควบคุมเมื่อหมดอายุ
- ไม่มี developer wording เช่น token, endpoint หรือ stack trace ใน UI ปกติ

QR scope:

- assignment-scoped
- ผูก driver และ vehicle ตาม assignment
- มี expiry/revoke
- raw token ไม่ถูก log ใน telemetry
- หลัง mobile session พร้อม ให้ลบ raw token จาก SecureStore

Deep links:

- `tompdriver://activate?token=...`
- HTTPS QR fallback ยังเปิด Web ได้
- reject scheme/host ที่ไม่อยู่ใน allow-list

## 14. Phase A8 — Push notification หลัง GPS gate ผ่าน

ทำหลัง A0–A7 และ Android GPS device test ผ่านเท่านั้น

เพิ่ม `expo-notifications` สำหรับ:

- งานใหม่
- เปลี่ยนเวลา
- เปลี่ยนจุดรับ/จุดส่ง
- เปลี่ยนเส้นทาง
- ข้อความจากศูนย์ควบคุม
- ยกเลิกงาน

ห้ามเก็บ Expo push token ใน metadata แบบไร้โครงสร้างระยะยาว แนะนำตาราง device registration แยกที่ผูก mobile session/installation และมี revoke/last-seen

Notification payload ห้ามใส่ raw QR token หรือข้อมูลส่วนบุคคลที่ไม่จำเป็น หน้าจอล็อกควรแสดงข้อความทั่วไป เช่น “มีการอัปเดตงานจากศูนย์ควบคุม”

## 15. Phase A9 — Android device test

Expo Go ใช้พิสูจน์ background GPS ไม่ได้ ต้องใช้ Development Build หรือ Preview APK

สร้าง preview:

```powershell
Set-Location apps/mobile-driver
npx.cmd eas-cli build --profile preview --platform android --non-interactive
```

ห้ามใส่ Expo access token ลง Git หรือ command history ที่ถูกบันทึกในเอกสาร ใช้ environment/credential store ของเครื่องและ rotate token ที่เคยเปิดเผย

Device matrix ขั้นต่ำ:

- Android stock/ใกล้ stock อย่างน้อย 1 เครื่อง
- หากจะ pilot กับ Samsung/Xiaomi/Oppo/Vivo ให้เพิ่มอย่างน้อย 1 เครื่องจากกลุ่มที่ใช้งานจริง

Test cases:

| กรณี | ผลที่ต้องได้ |
|---|---|
| สแกน QR | เปิดงานถูก assignment |
| PIN ผิด | ไม่สร้าง mobile session และ rate limit ทำงาน |
| PIN ถูก | Web session และ mobile session ผูกอุปกรณ์เดียวกัน |
| Pre-flight | รูปรถ/ป้ายทะเบียนอัปโหลดและ Mission Control เห็น |
| เริ่ม GPS | มี foreground notification และ server รับ `sharing_started` ครั้งเดียว |
| Background 5 นาที | พิกัดยังอัปเดต |
| ล็อกจอ 10 นาที | พิกัดยังอัปเดตตามข้อจำกัดเครื่อง |
| สลับ Wi-Fi/Cellular | ไม่สูญเสียสถานะ session |
| Offline 10 นาที | queue เก็บข้อมูลและส่งซ้ำตามลำดับเมื่อออนไลน์ |
| Permission ถูกปิด | WebView และ Mission Control แสดงสถานะไม่พร้อม ไม่แสดง live |
| Session ถูก revoke | background task หยุดส่งและแอปขอ QR ใหม่ |
| Assignment completed | ส่งสถานะครั้งเดียวและหยุด GPS ตาม policy |
| เปิด QR บนอุปกรณ์ที่สอง | ถูกปฏิเสธตาม device-binding policy |
| Force stop | แจ้งข้อจำกัดเมื่อเปิดใหม่และไม่กล่าวอ้างว่าติดตามต่อเนื่อง |

ตรวจ Mission Control ทุกกรณี:

- project ถูกต้อง
- assignment ถูกต้อง
- driver ถูกต้อง
- vehicle/ทะเบียนถูกต้อง
- Call Sign ถูกต้อง
- recorded time และ received time ไม่สับสน
- marker เปลี่ยนสีตาม freshness rule เดียวกับ Web
- ไม่มีตำแหน่งข้าม project

## 16. Phase A10 — CI และ release evidence

เพิ่ม mobile workflow แยกจาก Web เพื่อไม่ทำให้ Agent งาน Web ติดขัด:

Trigger เมื่อเปลี่ยน:

- `apps/mobile-driver/**`
- `packages/types/**`
- `packages/driver-core/**`
- driver API/session contract

CI:

```powershell
npm.cmd ci --prefix apps/mobile-driver
npm.cmd run typecheck --prefix apps/mobile-driver
npx.cmd expo-doctor apps/mobile-driver
```

เพิ่ม unit tests สำหรับ:

- QR/deep-link parser
- bridge message validation
- mobile session expiry/restore
- queue ordering/backoff/coalescing
- GPS state mapping
- allowed navigation URL

Release evidence ต้องมี:

- commit hash
- app version + Android version code
- EAS build ID และ download URL
- build profile
- test device รุ่น/Android version
- เวลาเริ่ม/สิ้นสุด location test
- จำนวน ping ที่ส่ง/สำเร็จ/queued/retried
- screenshot Mission Control ที่ผูก driver/vehicle ถูกต้อง
- known OEM/battery limitations

## 17. Definition of Done สำหรับ Android Pilot

Android App Shell พร้อมให้ทดสอบภายในเมื่อทุกข้อผ่าน:

- [ ] Mobile app เป็น WebView shell ไม่ใช่ Driver UI ซ้ำ
- [ ] PIN และ pre-flight ใช้ flow เดียวกับ Driver Web
- [ ] raw QR token ใช้ activation เท่านั้น
- [ ] background API ใช้ scoped Mobile Driver Session
- [ ] service-role key ไม่อยู่ใน APK/bundle
- [ ] GPS มี owner เดียว ไม่มี ping ซ้ำจาก Web และ Native
- [ ] foreground notification แสดงตลอดช่วง background tracking
- [ ] สถานะ live/slow/offline ตรงกับข้อมูลที่ server รับจริง
- [ ] offline queue ไม่สูญเสีย status/issue/start-stop
- [ ] Mission Control ผูก project/assignment/driver/vehicle ถูกต้อง
- [ ] QR revoke ทำให้ Web และ Native session ใช้ต่อไม่ได้
- [ ] Preview APK ติดตั้งได้โดยไม่ผ่าน Play Store
- [ ] ทดสอบ background และ lock screen บน Android จริงผ่าน
- [ ] mobile typecheck, tests และ Expo Doctor ผ่าน
- [ ] เอกสารข้อจำกัด Force stop/battery optimization ชัดเจน

## 18. ลำดับ commit ที่แนะนำ

1. `mobile: establish android app-shell baseline and config`
2. `mobile: replace duplicated driver screens with guarded webview shell`
3. `mobile: add validated web-native bridge protocol`
4. `driver-auth: add one-time mobile session exchange`
5. `mobile: use scoped session for background location`
6. `mobile: migrate offline outbox to sqlite`
7. `mobile: add android device-test instrumentation`
8. `ci: verify mobile driver app`
9. `docs: record android preview build and device-test evidence`

อย่ารวมทุกอย่างเป็น commit เดียว และอย่า deploy production API contract ก่อน Web, Mobile และ rollback path พร้อมกัน

## 19. Rollback

หาก App Shell มีปัญหา:

1. Revoke mobile sessions รุ่นนั้นจาก server
2. ปิด mobile-session exchange ด้วย server feature flag
3. Driver Web ยังคงใช้งาน foreground GPS ได้ตามเดิม
4. Mission Control ไม่ต้อง rollback schema หาก migration เป็น additive
5. ห้ามเปิด raw-token operational API กลับมาเพื่อแก้ชั่วคราว

## 20. เอกสารอ้างอิงทางเทคนิค

- Expo Location: https://docs.expo.dev/versions/latest/sdk/location/
- Expo TaskManager: https://docs.expo.dev/versions/latest/sdk/task-manager/
- EAS internal distribution: https://docs.expo.dev/build/internal-distribution/
- Build APK with EAS: https://docs.expo.dev/build-reference/apk/
- Expo Notifications: https://docs.expo.dev/versions/latest/sdk/notifications/
- React Native WebView: https://github.com/react-native-webview/react-native-webview

## 21. คำสั่งสำหรับ Agent

เริ่มจาก worktree แยกและทำ A0–A2 ใน `apps/mobile-driver` เท่านั้นก่อน จากนั้นรอ/rebase งาน security ของ Web แล้วออกแบบ A3 Mobile Session Exchange ให้ผ่าน PIN โดยห้ามเปิด raw-token API กลับมา เมื่อ A3 ผ่านจึงทำ bridge, background GPS, SQLite outbox และ Preview APK ตามลำดับ ต้องรายงานผลจาก Android เครื่องจริง ไม่ใช้ Expo Go หรือ simulator เป็นหลักฐาน background GPS และห้ามประกาศพร้อมใช้งานจน Definition of Done ทุกข้อผ่าน
