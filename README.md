# TOMP Enterprise Platform

TOMP คือ Transportation Operations Management Platform สำหรับวางแผน เตรียมความพร้อม ประกาศใช้แผน ปฏิบัติการ กู้คืนสถานการณ์ และทบทวนงานขนส่งแบบ event-based

TOMP ไม่ใช่ fleet maintenance, ERP, CRM, payroll, accounting หรือ route optimization จุดโฟกัสคือ operations management: โครงการ ภารกิจ Assignment, Call Sign, Driver Card, GPS visibility, Timeline, Publish และ Change Request

## สถานะปัจจุบัน

Repository นี้อยู่ในระดับ **Thai-first Internal Pilot UI/UX reset** รอบล่าสุดยกระดับหน้าจอหลักให้ดูเป็น Transportation Operations Command Platform มากขึ้น โดยไม่เพิ่ม business scope ใหม่

สิ่งที่ใช้งานและทดสอบได้:

- Dashboard แบบภาพรวมการปฏิบัติการ
- Mission Control แบบ command center พร้อม KPI, live map, signal panel, exceptions และ Timeline
- Project Workspace สำหรับวางแผน เตรียมพร้อม ประกาศใช้แผน และ change control
- Dispatch Board สำหรับ Assignment, Call Sign, คนขับ, รถ และ QR
- Driver Card แบบ mobile-first สำหรับคนขับ
- GPS sharing ผ่าน web app สำหรับ internal pilot
- Resources workspace สำหรับความพร้อมคนขับและรถ
- Pilot checklist แบบ guided journey
- Supabase migrations, seed, read/write helpers และ server actions

## วิธีรันในเครื่อง

ต้องใช้ Node.js 20+ และ npm

```bash
npm install
cp .env.example .env.local
npm run dev -- --port 7000
```

เปิดระบบที่ `http://localhost:7000`

คำสั่งตรวจคุณภาพ:

```bash
npm run typecheck
npm run lint
npm run test
NEXT_TELEMETRY_DISABLED=1 npm run build
```

บน Windows หาก `npm.ps1` ถูกบล็อก ให้ใช้ `npm.cmd` แทน

## Supabase

ตั้งค่า environment variables ใน `.env.local` เท่านั้น ห้าม commit secret key หรือ service-role key ขึ้น Git

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
DRIVER_ACCESS_TOKEN_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:7000
```

คู่มือ Supabase local: `docs/10-deployment/1001-supabase-local-setup.md`

Seed สำหรับ Pilot ภาษาไทย: `database/seed/0002_thai_pilot_scenario.sql`

## GPS และข้อจำกัดของ Web App

Web app สามารถส่ง GPS ได้ขณะหน้าเว็บยังทำงานอยู่ และพยายามใช้ Screen Wake Lock หาก browser รองรับ แต่ web app ล้วนไม่สามารถรับประกัน background GPS หลังสลับแอปหรือล็อกจอได้ ถ้าต้องการ production-grade background tracking ต้องทำ driver companion app แบบ native หรือ hybrid ใน sprint ถัดไป

เอกสาร: `docs/08-engineering/810-web-location-limits-and-native-background-plan.md`

## สิ่งที่ยังไม่ใช่ production-ready

- Auth/RBAC ต้อง harden กับผู้ใช้จริงและ RLS ที่ตรวจครบ
- QR token expiry/revoke และ secret rotation ต้องทดสอบเพิ่มเติม
- Web GPS ไม่รับประกัน background tracking
- Mission Control map ยังเป็น pilot-grade web map panel
- ยังไม่มี E2E test ครบทุก flow
- ยังไม่เปิด AI, route optimization, accounting, CRM, payroll, fleet maintenance, vendor portal หรือ customer portal

## เอกสารสำคัญ

- Product constitution: `docs/00-foundation/000-product-constitution.md`
- Product experience reset: `docs/05-ux/504-product-experience-reset.md`
- Thai copy guideline: `docs/05-ux/505-thai-copy-guideline.md`
- Very big change audit: `docs/11-codex/908-very-big-change-ui-ux-audit.md`
- Thai pilot scenario: `docs/09-testing/906-thai-internal-pilot-scenario.md`

## ขั้นตอนถัดไป

แนะนำ Sprint UX-43: polish forms, loading/empty states, browser screenshot smoke test, และ real mobile pilot test กับบทบาท Operation Manager, Dispatcher, Coordinator และ Driver
