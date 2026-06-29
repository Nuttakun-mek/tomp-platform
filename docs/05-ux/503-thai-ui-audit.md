# Thai UI Audit

วันที่ตรวจ: 2026-06-30

## Pages Reviewed

- ภาพรวม
- โครงการ
- สร้างโครงการ
- รายละเอียดโครงการ
- Assignment planning
- ทรัพยากร
- คนขับ
- รถ
- หน้าคนขับ
- Driver Card จาก QR
- ศูนย์ควบคุมปฏิบัติการ
- เข้าสู่ระบบ
- ทดสอบ Pilot

## Summary

UI หลักถูกปรับเป็น Thai-first และยกระดับ visual design ให้เหมาะกับ internal pilot มากขึ้น รอบนี้เน้น mobile driver experience, Mission Control dashboard, form grouping, Thai validation messages, clean navigation, และ shared UI primitives

## Remaining English Terms

| Term | Reason |
| --- | --- |
| TOMP | ชื่อผลิตภัณฑ์ |
| Assignment | core domain term ของระบบ |
| Call Sign | operational identity |
| QR | คำที่ผู้ใช้ทั่วไปเข้าใจ |
| GPS | คำเทคนิคด้านตำแหน่ง |
| Google Maps | ชื่อบริการนำทาง |

## Readiness

- Thai UI readiness: 8.5/10
- Mobile driver readiness: 8.5/10
- Mission Control readiness: 8/10
- Pilot readiness: 8/10

## Remaining Issues

- ข้อความ error จากฐานข้อมูลจริงอาจยังเป็นภาษาอังกฤษบางส่วน
- ต้องทดสอบ Driver Card บนมือถือจริงหลายขนาด
- ต้องทดสอบ Mission Control กับทีมปฏิบัติการจริงเพื่อปรับ density
- ยังไม่ควรประกาศว่า production-ready จนกว่า auth, RBAC, token security, storage policy, realtime และ E2E test จะผ่านการตรวจจริง
