# Enterprise Hardening Batch Audit

อัปเดต: 28/07/2026 Asia/Bangkok

## เป้าหมาย

ยกระดับ TOMP จาก internal pilot prototype ไปสู่ enterprise hardening foundation โดยเริ่มปิด 12 แกนที่ยังค้าง:

1. Auth/RBAC
2. GPS
3. Data governance
4. Publish/change
5. Realtime Mission Control
6. Driver workflow
7. QR/token security
8. Supabase security
9. Testing
10. UX/UI
11. Recovery
12. Deployment/Operations

## สิ่งที่เพิ่มใน batch นี้

- เพิ่ม incident/recovery domain types และ Zod schemas
- เพิ่ม pure recovery rules และ unit tests
- เพิ่ม server action สำหรับเปิดเหตุผิดปกติและเปลี่ยนสถานะเหตุ
- เพิ่มหน้า `/recovery` สำหรับศูนย์ควบคุมบันทึกเหตุผิดปกติ
- เพิ่มหน้า `/admin/enterprise-readiness` สำหรับตรวจ 12 แกนระบบ
- เพิ่ม production risk flag ใน current user fallback
- ย้ำว่า web GPS ไม่ใช่ background GPS ขณะปิดจอ

## สิ่งที่พร้อมทดสอบ

- เปิดเหตุผิดปกติจากหน้า Recovery
- ระบบบันทึกลง `driver_issue_reports`
- ระบบสร้าง Timeline event `INCIDENT_OPENED`
- ระบบสร้างคำแนะนำ recovery จาก rule ที่ทดสอบได้
- Admin เห็น readiness ของ 12 แกน

## สิ่งที่ยังไม่ใช่ production 100%

- ยังไม่มี native Mobile Driver App สำหรับ background GPS ตอนปิดจอ
- ยังไม่มี automated RLS test กับ Supabase Auth user จริง
- Recovery ยังเป็น foundation ไม่ใช่ approval/dispatch replacement workflow เต็ม
- Publish/change ยังต้องเพิ่ม transaction guarantee
- Monitoring/alerting/backup ยังเป็น checklist ไม่ใช่ระบบ observability เต็ม

## Recommendation

รอบถัดไปควรทำ:

1. Real Auth Flow + Project Scoped RBAC end-to-end
2. Supabase RLS automated verification
3. Mobile Driver App MVP with Expo background location
4. Incident/Recovery workflow detail: replacement driver/vehicle and coordinator escalation
5. Playwright E2E for create project -> assignment -> QR -> GPS -> Mission Control -> incident
