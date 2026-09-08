# Production Readiness Audit + Hardening

**วันที่:** 2026-09-08 · **Branch:** `main` (deployed)

หลัง deploy Phases 0–5a — ตรวจสอบความพร้อม production จริง

---

## 🔴 พบ: ก่อนหน้านี้ "login ไม่ได้เลยบน production"

| ปัญหา | สาเหตุ | สถานะ |
|---|---|---|
| หน้า `/login` มีแค่ magic link + Google | ไม่มีช่องรหัสผ่าน — admin ที่ bootstrap มี password แต่ใช้ไม่ได้ | ✅ **แก้แล้ว** — เพิ่ม password login (primary), magic link เป็น toggle |
| magic link ใช้ implicit flow (`#hash`) | `signInWithOtp` เรียกบน plain client — server callback อ่าน hash ไม่ได้ | ✅ แก้แล้ว — ใช้ PKCE (session-aware) client → `?code=` |
| Supabase `site_url = http://localhost:3000` | ไม่เคยตั้งสำหรับ prod | ⚠️ **ต้องแก้ใน Supabase dashboard** (ผมแก้ผ่าน API ไม่ได้ — ถูก block) |
| Supabase `uri_allow_list = ""` | redirect ไม่ allowlist | ⚠️ ต้องแก้ใน dashboard |
| Google button แต่ `external_google_enabled = false` | ไม่มี OAuth credentials | คงไว้ (มี error message) — เปิด provider หรือซ่อนปุ่มภายหลัง |

## 🟠 Hardening ที่ทำแล้วในโค้ด

- **security headers** ใน `vercel.json` (legacy config bypass `next.config` headers): HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (geolocation=self สำหรับคนขับ)
- **`provisionUser`** สร้าง auth user (email_confirm) + temp password ตอน invite → ผู้ใช้ sign IN ไม่ใช่ sign UP → เปิด `disable_signup` ได้ปลอดภัย; UI แสดง temp password ให้ admin ส่งต่อ
- `signInWithOtp` + `shouldCreateUser: false`

## ⚠️ ต้องทำเอง (ผมถูก block จาก classifier)

### 1. Supabase dashboard → Authentication
- **URL Configuration:**
  - Site URL: `https://tomp-platform.vercel.app`
  - Redirect URLs: `https://tomp-platform.vercel.app/**` · `https://tomp-platform-*.vercel.app/**` · `http://localhost:3000/**`
- **Providers → Email:** Confirm email = on; **Allow new users to sign up = OFF** (หลัง deploy นี้)
- **Policies:** Password min length ≥ 12
- (ถ้าจะใช้) **Providers → Google:** ใส่ Client ID/Secret → เปิด — ไม่งั้นปุ่ม Google error

### 2. Vercel → Settings → Environment Variables (Production)
- เช็ค `NEXT_PUBLIC_APP_URL` = `https://tomp-platform.vercel.app` (ตั้งไว้ 41 วันก่อน — ค่าปัจจุบันไม่ทราบ)
- (หลัง staging test) เพิ่ม `TOMP_SCOPED_READS` = `1` → เปิด RLS-enforced reads สำหรับ user ที่ไม่ใช่ super_admin

### 3. Email delivery
- Supabase built-in email limit ~2-4/ชม. (`rate_limit_email_sent: 2`) — password login เลี่ยงได้ แต่ถ้าจะใช้ magic link / password reset จริงจัง → ตั้ง **custom SMTP** (Auth → Emails → SMTP Settings)

### 4. Rotate secrets
- Supabase access token `sbp_fc93...` → supabase.com/dashboard/account/tokens
- admin temp password (`Tomp-Tc5qTOUqfZRh`) → เปลี่ยนหลัง login ครั้งแรก

## ✅ ตรวจแล้ว — ไม่มีปัญหา
- Vercel prod env มี Supabase keys + `DRIVER_ACCESS_TOKEN_SECRET` ครบ
- `TOMP_ALLOW_AUTH_FALLBACK` / `TOMP_ENABLE_POSTGRES_FALLBACK` ไม่ได้ตั้งใน prod → ไม่มี auth bypass, ไม่มี demo data
- middleware: บังคับ login ทุก path ยกเว้น `/login /auth/callback /driver /api/driver /api/health /no-access`
- RLS 0019/0020 live บน prod DB
- prod DB: admin จริง 1 คน, 0 test data
- redirects route เก่า → 307 (แก้ใน `vercel.json`)

## ค้าง (feature — Phase 4b/5b)
role matrix editor · `/coordinator` `/vendor` `/changes` · RLS write policies · `<UndoToast>` · command palette
