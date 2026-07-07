# Pilot Flow Completion Audit

วันที่อัปเดต: 08/07/2026 00:57 น. Asia/Bangkok

## เป้าหมายรอบนี้

ปิดงานค้างที่ทำให้ internal pilot ใช้งานต่อไม่ได้ โดยเน้น flow จริง:

1. สร้างโครงการ
2. สร้างภารกิจ
3. สร้าง Assignment
4. สร้าง QR สำหรับคนขับ
5. คนขับเปิด web app และแชร์ GPS
6. Mission Control เห็นตำแหน่งล่าสุด

## สิ่งที่แก้แล้ว

- แก้ข้อความภาษาไทยเพี้ยนใน flow สำคัญ
- แก้ error duplicate project code ให้ผู้ใช้เข้าใจง่าย
- ปรับฟอร์ม Project / Mission / Assignment ให้เป็นภาษาไทยชัดเจน
- เพิ่ม QR จริงจากลิงก์ driver access ด้วย `qrcode`
- ปรับ driver GPS share ให้ส่ง metadata ระบุ project, assignment, call sign, driver, phone, vehicle
- ปรับ API รับตำแหน่งให้คืน error ภาษาไทยชัดเจน
- ปรับ Mission Control map ให้แสดงสถานะสด / ช้า / หยุดแชร์ / ขาดการอัปเดต
- ปรับ pilot smoke action ให้สร้างข้อมูลภาษาไทยถูกต้อง ไม่สร้างข้อมูล encoding เพี้ยนเพิ่ม
- อัปเดต build version เป็น `v2026.07.08.0057`

## ผลการตรวจ

- `npm install` ผ่าน
- `npm run typecheck` ผ่าน
- `npm run lint` ผ่าน
- `npm run test` ผ่าน
- `NEXT_TELEMETRY_DISABLED=1 npm run build` ผ่าน
- local production routes ผ่าน:
  - `/`
  - `/live-test`
  - `/mission-control`
  - `/driver`

## ข้อจำกัดที่ยังต้องรู้ก่อนทดสอบจริง

- Web app ไม่สามารถรับประกัน background location เมื่อคนขับล็อกจอหรือสลับแอป
- ต้องทดสอบ permission location บนมือถือจริง
- Supabase production data เก่าที่เคย encoding เพี้ยนควรถูกล้างหรือแยก archive
- ยังไม่ได้ทำ native mobile app สำหรับ background GPS
- ยังไม่ได้ทำ role/auth production-hardening เต็มรูปแบบ

## ขั้นตอนทดสอบแนะนำ

1. เปิด `/live-test`
2. กดสร้างชุดทดสอบ GPS สด
3. เปิดลิงก์คนขับบนมือถือ
4. กดเริ่มแชร์ตำแหน่งและอนุญาต location
5. เปิด Mission Control จากลิงก์ที่ระบบให้
6. ตรวจว่าหมุดขึ้นและสถานะแสดงเป็น “กำลังแชร์”
