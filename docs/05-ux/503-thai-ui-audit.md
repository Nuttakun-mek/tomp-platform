# Thai UI Audit

วันที่ตรวจ: 2026-06-29

## ขอบเขตที่ตรวจ

- ภาพรวม
- โครงการ
- รายละเอียดโครงการ
- Assignment planning
- ทรัพยากร คนขับ และรถ
- หน้าคนขับและ Driver Card
- Mission Control
- Login
- Publish และ Change Request
- Pilot checklist

## สรุปผล

UI หลักถูกปรับเป็น Thai-first แล้ว โดยใช้ภาษาไทยแบบทางการแต่เข้าใจง่ายสำหรับทีมปฏิบัติการและคนขับ หน้าคนขับถูกปรับให้ mobile-first พร้อมปุ่มขนาดใหญ่และคำสั่งที่ตรงกับการปฏิบัติงานจริง

## คำอังกฤษที่ตั้งใจคงไว้

| คำ | เหตุผล |
| --- | --- |
| TOMP | ชื่อผลิตภัณฑ์ |
| Assignment | เป็น core domain term ที่ใช้ใน handbook และ UI วางแผน |
| Call Sign | เป็น operational identity เฉพาะทาง |
| QR | เป็นคำที่ผู้ใช้ทั่วไปเข้าใจอยู่แล้ว |
| GPS | เป็นคำเทคนิคที่ใช้กับตำแหน่ง |
| Google Maps | ชื่อบริการนำทาง |
| Timeline | เป็นแนวคิดหลักของระบบและใช้คู่กับคำอธิบายภาษาไทย |
| Mission Control | ใช้คู่กับคำอธิบายภาษาไทยว่า “ศูนย์ควบคุมปฏิบัติการ” |
| Supabase, Vercel | ใช้ในเอกสารเทคนิคเท่านั้น |

## ประเด็นที่ยังต้องตรวจโดยผู้ใช้จริง

- คำว่า Assignment ควรคงไว้หรือใช้ “งานที่จัดสรร” ในบางหน้าสำหรับผู้ใช้ใหม่
- Driver Card ควรทดสอบกับคนขับจริงบนมือถือหลายขนาด
- Mission Control ควรทดสอบกับทีม control room เพื่อปรับ density ของข้อมูล
- ข้อความ error จาก server actions บางส่วนยังอาจมาจากฐานข้อมูลเป็นภาษาอังกฤษ

## คะแนนความพร้อม

Thai-first internal pilot readiness: 8/10

ยังไม่ควรประกาศว่า production-ready จนกว่า auth, RBAC, token security, storage policy, realtime และ E2E test จะผ่านการตรวจจริง
