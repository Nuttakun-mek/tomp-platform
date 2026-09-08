"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { getAuthBrowserClient } from "@/lib/auth/auth-client";

const PUBLIC_PREFIXES = ["/login", "/auth/callback", "/driver", "/api/driver", "/api/health"];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function AuthGate({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const publicPath = isPublicPath(pathname);
  const next = useMemo(() => `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`, [pathname, searchParams]);

  useEffect(() => {
    let active = true;
    if (publicPath) {
      setReady(true);
      return;
    }

    const client = getAuthBrowserClient();
    if (!client) {
      router.replace(`/login?reason=missing-auth-config&next=${encodeURIComponent(next)}`);
      return;
    }

    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      setReady(true);
    });

    return () => {
      active = false;
    };
  }, [next, publicPath, router]);

  if (!ready && !publicPath) {
    return (
      <div className="grid min-h-[calc(100vh-64px)] place-items-center px-4">
        <div className="grid justify-items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-6 py-8 text-center shadow-soft">
          <Loader2 className="h-6 w-6 animate-spin text-operation" />
          <div>
            <p className="font-semibold text-ink">กำลังตรวจสิทธิ์การเข้าใช้งาน</p>
            <p className="mt-1 text-sm text-slate-500">หากยังไม่ได้เข้าสู่ระบบ ระบบจะพาไปหน้าเข้าสู่ระบบ</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
