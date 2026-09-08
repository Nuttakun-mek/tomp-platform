import { AccessDenied } from "@/components/auth/access-denied";

export default function NoAccessPage() {
  return (
    <AccessDenied
      title="ยังไม่ได้รับสิทธิ์เข้าใช้งาน"
      reason="บัญชีของคุณเข้าสู่ระบบสำเร็จ แต่ยังไม่ได้ถูกกำหนดบทบาทในระบบ กรุณาติดต่อผู้ดูแลเพื่อเพิ่มสิทธิ์"
    />
  );
}
