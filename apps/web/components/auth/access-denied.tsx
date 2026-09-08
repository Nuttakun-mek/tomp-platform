import Link from "next/link";
import { ShieldX } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

interface AccessDeniedProps {
  title?: string;
  reason?: string;
  requiredRole?: string;
}

export function AccessDenied({ title = "บัญชีนี้ยังไม่ได้รับสิทธิ์", reason, requiredRole }: AccessDeniedProps) {
  return (
    <section className="mx-auto grid min-h-[60vh] w-full max-w-lg content-center gap-4 px-4">
      <div className="enterprise-panel grid gap-4 p-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-panel bg-rose-50 text-rose-600">
          <ShieldX className="h-6 w-6" />
        </span>
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-description mx-auto mt-2">
            {reason || "กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าใช้งานส่วนนี้"}
            {requiredRole ? ` (ต้องมีบทบาท: ${requiredRole})` : ""}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-panel bg-operation px-5 text-sm font-semibold text-white transition hover:bg-operation-deep"
          >
            กลับหน้าแรก
          </Link>
          <LogoutButton variant="light" />
        </div>
      </div>
    </section>
  );
}
