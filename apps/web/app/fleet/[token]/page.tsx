import { cookies } from "next/headers";
import { AlertTriangle } from "lucide-react";
import { FleetPinGate } from "@/components/fleet-view/fleet-pin-gate";
import { FleetView } from "@/components/fleet-view/fleet-view";
import { OBSERVER_PIN_COOKIE_PREFIX } from "@/lib/driver-access/token";
import { getFleetViewByToken } from "@/lib/data/fleet-view";
import { getRequestLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function FleetPage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token }, locale, cookieStore] = await Promise.all([params, getRequestLocale(), cookies()]);
  const view = await getFleetViewByToken(decodeURIComponent(token));

  if (!view) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-8 text-slate-950">
        <section className="max-w-lg rounded-[28px] border border-rose-100 bg-white p-6 text-center shadow-2xl shadow-slate-300/40">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">{locale === "th" ? "ไม่สามารถเปิดหน้าติดตามได้" : "Fleet view is not available"}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {locale === "th"
              ? "ลิงก์นี้ไม่พร้อมใช้งาน กรุณาติดต่อศูนย์ควบคุมเพื่อขอลิงก์ใหม่"
              : "This link is not available. Please contact the control centre for a new link."}
          </p>
        </section>
      </main>
    );
  }

  const unlocked = cookieStore.get(`${OBSERVER_PIN_COOKIE_PREFIX}${view.tokenId}`)?.value === "1";
  if (view.requiresPin && !unlocked) return <FleetPinGate token={decodeURIComponent(token)} locale={locale} />;

  return <FleetView view={view} locale={locale} />;
}
