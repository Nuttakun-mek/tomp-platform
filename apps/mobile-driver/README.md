# TOMP Driver Mobile App

แอปนี้คือ MVP สำหรับคนขับบน Android และ iOS โดยใช้ React Native + Expo

## สถานะปัจจุบัน

ใช้งานได้สำหรับการทดสอบภายใน:

- เปิดงานจาก QR/token
- โหลด assignment packet จาก TOMP Web API
- แสดง Call Sign, โครงการ, จุดรับ, จุดส่ง, เวลา และรถ
- เปิด Google Maps
- ส่งข้อมูลความพร้อม
- ส่งสถานะงาน
- แจ้งปัญหาไปศูนย์ควบคุม
- แชร์ GPS แบบ foreground
- เตรียม background location เมื่อระบบมือถือและ permission อนุญาต

## วิธีรัน

จาก root repository:

```bash
npm install
npm run dev:mobile
```

จากนั้นสแกน QR ของ Expo ด้วย Expo Go หรือกดเปิดบน Android/iOS simulator

## Environment

ค่าเริ่มต้นของ mobile app จะยิงไปที่ production:

```bash
EXPO_PUBLIC_TOMP_API_BASE_URL=https://tomp-platform.vercel.app
```

ถ้าต้องการทดสอบกับเครื่อง local ให้ตั้งค่าเป็น URL ที่มือถือเข้าถึงได้ เช่น ngrok หรือ LAN URL:

```bash
EXPO_PUBLIC_TOMP_API_BASE_URL=https://your-tunnel-url.ngrok.app
```

## ข้อจำกัด

- ยังไม่ได้ทำ App Store / Play Store build
- ยังไม่ได้ทำ push notification จริง
- ยังไม่ได้ทำ photo upload จากมือถือ
- background location ขึ้นกับ policy ของ Android/iOS และต้องทดสอบบนเครื่องจริง
- QR scanning ใน MVP ใช้วิธีเปิด deep link หรือวาง token ก่อน ยังไม่ได้เปิดกล้องสแกนในแอป
