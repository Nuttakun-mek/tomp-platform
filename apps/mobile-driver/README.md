# TOMP Driver App Shell

แอปนี้เป็น Android App Shell สำหรับคนขับในช่วง internal pilot โดย Web Driver page ยังเป็นหน้าหลักของงานคนขับ ส่วน native shell รับผิดชอบสิ่งที่ browser ทำได้ไม่เสถียรพอ ได้แก่ สแกน QR, deep link, SecureStore, WebView, bridge protocol และการเตรียม background GPS

## สถานะปัจจุบัน

- เปิดงานจาก QR, raw token หรือ `tompdriver://` deep link ได้
- แสดง Driver Web ผ่าน WebView ที่จำกัด allow-list เฉพาะหน้า TOMP คนขับและ Google Maps
- เตรียม bridge protocol รุ่น 1 สำหรับคำสั่ง `gps.start`, `gps.stop`, `open.url` และ `mobile-session.set`
- เก็บ installation id และ mobile session ใน SecureStore
- ไม่ใช้ raw QR token เป็น credential สำหรับ background GPS
- ยังไม่ประกาศว่า background GPS พร้อมใช้งานจริง จนกว่า Web/API เพิ่ม mobile session exchange หลัง PIN สำเร็จ

## สิ่งที่ยังไม่ใช่ production-ready

- Mobile session exchange endpoint ยังต้องทำฝั่ง Web/API ก่อน native GPS จะส่งข้อมูลเบื้องหลังได้จริง
- Push notification ยังไม่เปิดในรอบนี้
- Offline queue ยังเป็น SecureStore queue ขนาด 500 รายการ ยังไม่ใช่ SQLite outbox เต็มรูปแบบ
- ต้องทดสอบบน Android เครื่องจริงก่อนออก APK ให้คนขับทดลอง

## พัฒนาโดยไม่รอ EAS Build

ใช้ local development build เป็นวงจรหลัก เพื่อลดเวลารอและไม่ใช้ EAS quota ระหว่างแก้ App Shell

```powershell
Set-Location -LiteralPath "D:\Dev-Pro\tomp-platform-android-shell\apps\mobile-driver"
npm.cmd install
npx.cmd expo run:android --device
adb reverse tcp:8081 tcp:8081
npx.cmd expo start --dev-client --localhost
```

ถ้าต้องการให้ WebView ชี้ไป branch preview หรือ localhost:

```powershell
$env:EXPO_PUBLIC_TOMP_API_BASE_URL="https://<vercel-preview-url>"
npx.cmd expo start --dev-client --localhost --clear
```

ค่า default ตอนนี้คือ `https://tomp-platform.vercel.app`

## ตรวจคุณภาพ

```powershell
npm.cmd run typecheck --prefix apps/mobile-driver
npm.cmd run test --prefix apps/mobile-driver
npx.cmd expo-doctor apps/mobile-driver
```

ผลล่าสุดของ baseline App Shell:

- TypeScript: ผ่าน
- Unit tests: ผ่าน 13 tests
- Expo Doctor: ผ่าน 21/21 checks

## EAS Preview APK

ใช้เฉพาะเมื่อผ่าน device gate แล้วเท่านั้น

```powershell
Set-Location -LiteralPath "D:\Dev-Pro\tomp-platform-android-shell\apps\mobile-driver"
eas build --profile preview --platform android
```

Project:

- Expo account: `enexiss-team`
- Project slug: `tomp`
- EAS project id: `ea9c91b8-049d-4287-bfcd-dad4ecc7981b`
- Android package: `com.tomp.driver`

## Deep Link

ตัวอย่าง:

```text
tompdriver://open?token=<driver-token>
https://tomp-platform.vercel.app/driver/<driver-token>
```

ทั้งสองรูปแบบจะเปิด WebView ไปยังหน้า `/driver/<token>` ของ TOMP Web
