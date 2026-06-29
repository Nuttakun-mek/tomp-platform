# Driver Live Location Pilot

เอกสารนี้อธิบายชุดทดสอบเทคโนโลยีสำหรับให้คนขับเปิด web app แล้วแชร์ตำแหน่ง GPS เพื่อให้เจ้าหน้าที่ดูตำแหน่งล่าสุดบน Mission Control

## เป้าหมาย

- คนขับเข้าหน้า `/driver/[token]`
- คนขับกด `เริ่มแชร์ตำแหน่ง`
- browser ขอสิทธิ์ location จากเครื่องคนขับ
- web app ส่งตำแหน่งไปที่ server API `/api/driver/location`
- server ตรวจ token ที่ผูกกับ Assignment
- server บันทึกตำแหน่งลง `gps_locations`
- Mission Control แสดงตำแหน่งล่าสุดบนแผนที่ และ refresh ผ่าน Realtime หรือ polling fallback

## สิ่งที่ต้องมีใน Supabase

- ใช้ migration `database/migrations/0011_driver_live_location_pilot.sql`
- ตาราง `gps_locations` ต้องอยู่ใน publication `supabase_realtime`
- ต้องมี driver access token ที่ยังไม่หมดอายุ
- ต้องมี Assignment ที่ผูกกับ driver และ vehicle
- ฝั่ง server ต้องมี secret key เฉพาะใน environment ฝั่ง server เท่านั้น
- ฝั่ง browser ใช้ publishable key เท่านั้น

## Environment ที่ต้องตั้งค่า

ตัวอย่างสำหรับเครื่อง local:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_SECRET_KEY=<server-side-secret-key>
NEXT_PUBLIC_APP_URL=http://localhost:7000
DRIVER_ACCESS_TOKEN_SECRET=<shared-token-secret>
```

ห้ามใส่ `SUPABASE_SECRET_KEY` เป็น `NEXT_PUBLIC_*`

## Flow ทดสอบ

1. Apply migrations ถึง `0011_driver_live_location_pilot.sql`
2. Seed ข้อมูล pilot หรือสร้าง Project/Mission/Assignment จริง
3. สร้าง QR/token จากหน้าจัดสรรงาน
4. เปิด URL คนขับจากมือถือหรือ browser ที่อนุญาต location
5. กด `เริ่มแชร์ตำแหน่ง`
6. เปิด `/mission-control`
7. ตรวจว่าตำแหน่งล่าสุดขึ้นในส่วน `แผนที่ตำแหน่งคนขับ`

## ขอบเขตที่ยังไม่ใช่ production

- ยังไม่ใช่ระบบ fleet tracking เต็มรูปแบบ
- ยังไม่มี background tracking เมื่อปิด browser
- ยังไม่มี geofence
- ยังไม่มี route optimization
- ยังไม่มี policy เฉพาะ admin/driver ที่สมบูรณ์ทุกกรณี
- location ping ไม่ถูกเขียนลง Timeline ทุกครั้ง เพื่อป้องกัน Timeline noise
- Timeline จะบันทึกเฉพาะเหตุการณ์เริ่ม/หยุดแชร์ตำแหน่ง

## เหตุผลเชิงผลิตภัณฑ์

GPS ใช้เพื่อ visibility ของ operation เท่านั้น ไม่ใช่เพื่อควบคุมคนขับ TOMP ยังคงเป็นระบบ Operations Management สำหรับ Plan, Prepare, Operate, Adapt และ Improve
