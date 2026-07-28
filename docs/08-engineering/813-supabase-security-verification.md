# Supabase Security Verification

อัปเดต: 29/07/2026 Asia/Bangkok

## เป้าหมาย

ใช้ตรวจ Supabase ก่อนขยายจาก internal pilot ไป production จริง โดยเฉพาะ Auth, RLS, grants, service-role usage, Storage และ Realtime

## สิ่งที่ต้องตรวจ

1. ไม่มี `SUPABASE_SERVICE_ROLE_KEY` หรือ secret key ใดอยู่ใน `NEXT_PUBLIC_*`
2. server actions เท่านั้นที่ใช้ service role
3. ทุกตาราง operational ใน exposed schema ต้องเปิด RLS
4. anonymous role ต้องอ่าน operational tables ไม่ได้
5. authenticated user ต้องเห็นเฉพาะ project ที่เป็น member
6. driver QR/token ต้อง scope ตาม assignment
7. timeline ต้องไม่มี delete/edit UI
8. storage bucket สำหรับรูปต้องมี policy ตาม project/assignment path
9. realtime channel ต้องไม่เปิดข้อมูลข้าม project

## คำสั่งใน repo

```bash
npm run security:env
```

คำสั่งนี้ตรวจ source ว่าไม่มี `NEXT_PUBLIC_*SERVICE*` หรือ `NEXT_PUBLIC_*SECRET*`

## RLS verification

ใช้ไฟล์:

`database/tests/rls_project_scope_verification.sql`

ไฟล์นี้เป็น checklist SQL สำหรับ staging Supabase ต้องใช้ user จริงอย่างน้อย 2 คนและ project membership แยกกัน

## Production hardening ที่ยังต้องทำ

- สร้าง automated RLS test harness ที่ login เป็น user จริง
- เพิ่ม rate limit ให้ driver token validation และ location ping
- เพิ่ม audit log สำหรับ admin cleanup action
- เพิ่ม Supabase advisor run ใน release checklist
