# Driver Mobile App MVP

วันที่: 2026-07-30

## เป้าหมาย

ยกระดับหน้าคนขับจาก web-only เป็นแอปมือถือ Android/iOS เพื่อรองรับ GPS, background location, camera, notification และ workflow คนขับในอนาคต

## Stack

- React Native
- Expo
- TypeScript
- Expo Location
- Expo SecureStore
- Expo Notifications
- Expo Camera
- TOMP Web API เป็น backend boundary

## Flow ปัจจุบัน

1. คนขับเปิดแอป TOMP Driver
2. เปิดงานจาก QR/token
3. แอปเรียก `/api/driver/assignment`
4. แอปแสดง Call Sign, งาน, จุดรับ, จุดส่ง และ Google Maps
5. คนขับส่ง readiness
6. คนขับเปิดแชร์ GPS
7. แอปส่งตำแหน่งไป `/api/driver/location`
8. ศูนย์ควบคุมเห็นตำแหน่งใน Mission Control
9. คนขับส่งสถานะงานหรือแจ้งปัญหา

## API Boundary

Mobile app ไม่อ่าน Supabase ตรงเป็นค่าเริ่มต้น แต่เรียกผ่าน TOMP Web API:

- `GET /api/driver/assignment?token=...`
- `POST /api/driver/readiness`
- `POST /api/driver/status`
- `POST /api/driver/issue`
- `POST /api/driver/location`

เหตุผล:

- ไม่เปิด service-role key ในมือถือ
- รวม validation และ timeline event ไว้ฝั่ง server
- ง่ายต่อการเพิ่ม auth/RBAC ภายหลัง

## Background Location

MVP เตรียม `expo-task-manager` และ `expo-location` แล้ว โดยทำงานเมื่อ:

- คนขับอนุญาต foreground location
- คนขับอนุญาต background location
- OS ไม่จำกัดการทำงานเบื้องหลัง
- แอปถูก build เป็น development/production build ที่รองรับ background task

Expo Go อาจมีข้อจำกัดสำหรับ background location บางกรณี ต้องทดสอบด้วย development build บนเครื่องจริง

## ยังไม่เสร็จ

- กล้องสแกน QR ในแอป
- upload รูปรถ/ป้ายทะเบียน
- push notification จริง
- offline queue
- EAS build profile
- store signing
- production privacy policy สำหรับ location

## Next Step

Sprint Mobile-02:

- เพิ่ม camera QR scanner
- เพิ่ม EAS build config
- เพิ่ม Android internal testing APK
- เพิ่ม iOS TestFlight setup
- เพิ่ม offline queue สำหรับ location/status
