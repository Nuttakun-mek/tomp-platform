# Production Operations Runbook

อัปเดต: 29/07/2026 Asia/Bangkok

## ก่อนเริ่มทดสอบหรือใช้งาน Pilot

1. เปิด `/api/health`
2. เปิด `/admin/data-quality`
3. กดเก็บชุดทดสอบเก่าหากมีข้อมูล test ค้างหลายชุด
4. เปิด `/live-test` เพื่อสร้างชุด GPS test ใหม่
5. เปิดลิงก์คนขับบนมือถือจริง
6. กดเริ่มแชร์ GPS และอนุญาต location
7. เปิด `/mission-control` ตรวจหมุดและสถานะ GPS
8. หากพบปัญหา ให้เปิด `/recovery` และบันทึกเหตุผิดปกติ

## หลัง deploy production

รัน:

```bash
npm run smoke:production
```

ตรวจ version badge ใน sidebar ว่าตรงกับเวลาที่ deploy ล่าสุด

## Incident response เบื้องต้น

- GPS หาย: โทรคนขับ ตรวจว่าหน้า web app ยังเปิดอยู่หรือไม่
- QR ใช้ไม่ได้: สร้าง QR ใหม่จาก Assignment และตรวจ token expiry
- ข้อมูลเพี้ยน: ใช้ `/admin/data-quality` ก่อนแก้ข้อมูลจริง
- Mission Control ไม่ขึ้น: ตรวจ `/api/health` และ `/api/mission-control/locations`

## Backup และ rollback

- ใช้ Supabase backup ก่อน cleanup ข้อมูลจริง
- ห้ามลบ timeline events
- หาก Vercel deployment มีปัญหา ให้ rollback ไป deployment ก่อนหน้าจาก Vercel Dashboard

## ข้อจำกัดที่ยังต้องรู้

Web GPS ไม่ใช่ background GPS ตอนปิดจอ หากต้องการทำงานขณะสลับแอปหรือปิดจอ ต้องใช้ Mobile Driver App
