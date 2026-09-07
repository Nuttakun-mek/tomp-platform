# TOMP System Stabilization Plan

Updated: 2026-09-07

## เป้าหมาย

ปรับ TOMP ให้ทดสอบภายในได้จริงมากขึ้น โดยลดความสับสนของเมนู ทำให้ flow หลักชัดเจน และทำให้ระบบตอบข้อผิดพลาดจาก Supabase ได้เร็วและเข้าใจง่าย

## Flow หลักที่ต้องผ่าน

1. ผู้ดูแลเปิดเมนู `ทดสอบระบบจบขั้นตอน`
2. ระบบตรวจ Supabase และตารางสำคัญ
3. ระบบสร้างโครงการ ภารกิจ Assignment คนขับ รถ QR และ assignment packet
4. คนขับเปิดลิงก์ QR
5. คนขับกดเริ่มแชร์ GPS
6. Mission Control แสดงหมุด สีสถานะ และเวลาอัปเดตล่าสุด
7. Timeline บันทึกเหตุการณ์สำคัญ

## สิ่งที่ปรับในรอบนี้

- ยุบเมนูทดสอบใน sidebar ให้เหลือจุดเดียว เพื่อลดการหลง flow
- ปรับ API ตรวจ infrastructure ให้ตอบ 200 พร้อมสถานะ `ready: false` แทนการล้มเป็น 503 เมื่อ Supabase ยังไม่พร้อม
- เพิ่ม timeout สำหรับ Supabase server client และ write client
- ปิด Postgres direct fallback เป็นค่าเริ่มต้น เพื่อลดอาการค้างจาก connection string ผิด
- เพิ่ม timeout ใน data access layer หลักของ projects, missions, assignments, resources, timeline และ driver locations
- ทำให้ Mission Control แสดงแผนที่เสมอ พร้อมหมุดข้อมูลตัวอย่างเมื่อยังไม่มี GPS จริง
- ทำให้ตำแหน่ง GPS ผูกกับ project, assignment, Call Sign, driver และ vehicle metadata
- แก้ข้อมูลตัวอย่างภาษาไทยที่เคย encoding เพี้ยน
- เขียนหน้า Live Test ใหม่ให้ปุ่มไม่ค้าง และแสดงสาเหตุชัดเจนเมื่อ Supabase ยังไม่พร้อม

## Legend สถานะ GPS

- เขียว: กำลังแชร์ อัปเดตไม่เกิน 35 วินาที
- เหลือง: สัญญาณช้า เกิน 35 วินาที
- แดง: ขาดการอัปเดต เกิน 2 นาที
- เทา: หยุดแชร์แล้ว

## สิ่งที่ยังต้องแก้ก่อนทดสอบข้อมูลจริง

1. Supabase project URL ต้อง resolve ได้จาก server/Vercel
2. Supabase pooler connection string ต้องตรงกับ project ที่ active จริง
3. ต้อง apply migrations ทั้งหมดกับ Supabase project ที่ใช้งานจริง
4. ต้องรัน `/live-test` ใหม่หลังฐานข้อมูลพร้อม
5. ต้องตรวจว่า QR ที่สร้างเปิดหน้า driver ได้ และ driver ส่ง GPS เข้าตาราง `gps_locations`
6. ต้องจัดระเบียบเลข migration ที่มีเลขซ้ำก่อนใช้งาน production จริง

## แนวทางทดสอบหลัง Supabase พร้อม

1. เปิด `/live-test`
2. กด `เริ่มทดสอบระบบ`
3. ตรวจว่าทุกตารางผ่าน
4. สร้างชุดทดสอบ
5. เปิด QR บนมือถือ
6. กดแชร์ GPS
7. เปิด `/mission-control?projectId=<projectId>`
8. ตรวจว่าหมุดแสดงบนแผนที่และสถานะเปลี่ยนตามเวลาจริง

## ข้อจำกัดสำคัญ

Web/PWA GPS ทำงานดีที่สุดเมื่อหน้าแอปยังเปิดอยู่ หากต้องการ background location ตอนปิดจอหรือสลับแอป ต้องใช้ native Driver App ผ่าน Expo/EAS build
