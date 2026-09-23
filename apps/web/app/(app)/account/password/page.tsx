import { PageHeader } from "@/components/page-header";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { AccessDenied } from "@/components/auth/access-denied";
import { getCurrentUserProfile } from "@/lib/auth/current-user";

export default async function AccountPasswordPage() {
  const profile = await getCurrentUserProfile();
  if (!profile.authUserId) {
    return (
      <AccessDenied
        title="ไม่มีการเข้าสู่ระบบด้วยรหัสผ่าน"
        reason="บัญชีนี้ไม่ได้เข้าสู่ระบบด้วยอีเมล/รหัสผ่าน จึงไม่มีรหัสผ่านให้เปลี่ยน"
      />
    );
  }

  return (
    <>
      <PageHeader eyebrow="บัญชีของฉัน" title="เปลี่ยนรหัสผ่าน" description="ตั้งรหัสผ่านใหม่สำหรับบัญชีนี้" />
      <ChangePasswordForm />
    </>
  );
}
