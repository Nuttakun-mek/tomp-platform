# TOMP Enterprise Platform

TOMP คือ Transportation Operations Management Platform สำหรับวางแผน เตรียมความพร้อม ประกาศใช้แผน ปฏิบัติการ กู้คืนสถานการณ์ และทบทวนงานขนส่งแบบ event-based

TOMP ไม่ใช่ fleet maintenance, ERP, CRM, payroll, accounting หรือ route optimization จุดโฟกัสคือ operations management: Project, Mission, Assignment, Call Sign, Driver Card, Timeline, Publish และ Change Request

## สถานะปัจจุบัน

Repository นี้อยู่ในระดับ **Thai-first internal pilot foundation** รอบล่าสุดเน้น UI/UX hardening ไม่ได้เพิ่ม business scope ใหม่

สิ่งที่ใช้งานและทดสอบได้:

- หน้าเว็บ Next.js + TypeScript + Tailwind CSS
- โครงการ ภารกิจ Assignment ทรัพยากร คนขับ รถ และ Driver Card
- Mission Control สำหรับทีมปฏิบัติการ
- Publish baseline และ Change Request foundation
- Timeline แบบ immutable ไม่มี UI สำหรับแก้ไขหรือลบเหตุการณ์
- QR/driver access foundation แบบ assignment-scoped
- หน้า `ทดสอบ Pilot` สำหรับเดิน flow end-to-end
- Supabase schema, migrations, seed และ read/write helpers ฝั่ง server

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

## Supabase

ตั้งค่า environment variables ใน `.env.local` เท่านั้น ห้าม commit secret key หรือ service-role key ขึ้น Git

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DRIVER_ACCESS_TOKEN_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:7000
```

คู่มือ Supabase local: `docs/10-deployment/1001-supabase-local-setup.md`

Seed สำหรับ Pilot ภาษาไทย: `database/seed/0002_thai_pilot_scenario.sql`

## สิ่งที่ยังไม่ใช่ production-ready

- Auth/RBAC ต้อง harden กับผู้ใช้จริงและ RLS ที่ตรวจครบ
- QR token security ต้องทดสอบ expiry, revoke และ secret rotation จริง
- Photo upload ต้องตรวจ bucket policy และ signed URL
- Realtime Mission Control ยังเป็น foundation ไม่ใช่ live production GPS
- Publish/change application ยังต้อง audit side effects เพิ่ม
- ยังไม่มี E2E test ครบทุก flow
- ยังไม่เปิด AI, route optimization, accounting, CRM, payroll, fleet maintenance, vendor portal หรือ customer portal

## เอกสารสำคัญ

- Product constitution: `docs/00-foundation/000-product-constitution.md`
- Thai pilot scenario: `docs/09-testing/906-thai-internal-pilot-scenario.md`
- Thai UI audit: `docs/05-ux/503-thai-ui-audit.md`
- Thai pilot repository audit: `docs/11-codex/907-repository-audit-thai-ui-pilot.md`

## ขั้นตอนถัดไป

แนะนำ Sprint 31: Thai internal pilot hardening โดยทดสอบกับผู้ใช้จริง 3 บทบาท ได้แก่ operation manager, coordinator และ driver พร้อมเก็บ feedback เรื่องภาษาไทย, flow หน้างาน, QR, Timeline และ Mission Control
