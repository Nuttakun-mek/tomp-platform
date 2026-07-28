# Production Smoke Test

อัปเดต: 29/07/2026 Asia/Bangkok

## เป้าหมาย

ตรวจว่า production deployment เปิด route สำคัญได้จริงหลัง deploy

## คำสั่ง

```bash
npm run smoke:production
```

ค่าเริ่มต้นจะตรวจ:

`https://tomp-platform.vercel.app`

หากต้องการตรวจ domain อื่น:

```bash
TOMP_SMOKE_BASE_URL=https://your-domain.example npm run smoke:production
```

## Route ที่ตรวจ

- `/`
- `/api/health`
- `/admin`
- `/admin/enterprise-readiness`
- `/admin/data-quality`
- `/admin/operations`
- `/live-test`
- `/mission-control`
- `/driver`
- `/recovery`

## เกณฑ์ผ่าน

- ทุก route ต้องคืน status 2xx หรือ 3xx
- `/api/health` ต้องคืน `status: "ok"`

## สิ่งที่ smoke test ยังไม่แทนที่

- ไม่แทน E2E browser test
- ไม่ทดสอบการอนุญาต GPS บนมือถือจริง
- ไม่ทดสอบ RLS ด้วย Supabase Auth user จริง
- ไม่ทดสอบการเปิด QR จากมือถือ
