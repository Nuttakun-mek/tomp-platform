# Production Reset + Auth Handoff

วันที่: 2026-09-08

## สิ่งที่ดำเนินการ

- ล้างข้อมูล business/test data ใน Supabase production แล้ว โดยไม่ลบ schema, migration tracking, roles, permissions หรือ auth users
- เพิ่ม middleware บังคับเข้าสู่ระบบก่อนเข้าใช้งานหน้าหลัก
- ยกเว้นหน้าคนขับ `/driver` และ API สำหรับคนขับ เพื่อให้ QR access ยังทำงานได้
- เพิ่ม Supabase SSR session client สำหรับอ่าน session จาก cookie
- เพิ่มหน้า login ภาษาไทยสำหรับเจ้าหน้าที่
- เพิ่ม logout action ที่ล้าง session ผ่าน Supabase cookie-aware client
- เพิ่ม first-login bootstrap เฉพาะกรณี production ไม่มี profile ใด ๆ ในระบบ

## ตารางที่ล้างข้อมูลแล้ว

ล้างข้อมูลในตารางปฏิบัติการ เช่น organizations, profiles, projects, missions, assignments, vehicles, drivers, GPS, QR/token, timeline, publish/change และ driver operation tables ทั้งหมด

ไม่ได้ล้าง:

- `schema_migrations_tomp`
- `roles`
- `permissions`
- `role_permissions`
- `auth.users`

## วิธีสร้างบัญชีแรก

หลัง deploy ให้เข้าสู่ระบบด้วยอีเมลจริงผ่านหน้า `/login`

ถ้าในระบบยังไม่มี profile ใด ๆ:

- ระบบจะสร้าง organization เริ่มต้น
- ระบบจะสร้าง profile ให้ผู้ใช้คนแรก
- ระบบจะให้ role `super_admin`

ข้อควรระวัง: first-login bootstrap ใช้ได้เฉพาะตอนระบบไม่มี profile เลยเท่านั้น เพื่อป้องกันการยึดสิทธิ์ภายหลัง

## Script ที่เพิ่ม

```bash
npm run db:production:reset
npm run db:production:reset:confirm
npm run auth:bootstrap-admin
```

`auth:bootstrap-admin` ต้องตั้งค่า env:

- `TOMP_BOOTSTRAP_ADMIN_EMAIL`
- `TOMP_BOOTSTRAP_ADMIN_PASSWORD` ถ้าต้องการ password login
- `TOMP_BOOTSTRAP_ADMIN_NAME`

## สิ่งที่ยังต้องตรวจหลัง deploy

- ตั้งค่า Supabase Auth Site URL เป็น production URL
- ตั้งค่า redirect URL ให้รองรับ `/auth/callback`
- เปิด Email auth provider
- ถ้าจะใช้ Google ให้ตั้ง OAuth provider ใน Supabase ก่อน
- login ด้วยบัญชีแรก แล้วตรวจว่า profile ถูกสร้าง
- สร้างโครงการใหม่จริงจากหน้าระบบ
- สร้างภารกิจ งานที่จัดสรร และ QR ใหม่หลังล้างข้อมูล
