import { getObserverAccessView } from "@/lib/data/observer-access";
import { normalizeLocale, type LocaleCode } from "@/lib/i18n/locales";
import { getRequestLocale } from "@/lib/i18n/server";
import { ObserverTrackView } from "@/components/track/observer-track-view";

interface TrackPageProps {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ lang?: string }>;
}

export default async function ObserverTrackPage({ params, searchParams }: TrackPageProps) {
  const { token } = await params;
  const query = await searchParams;
  const locale: LocaleCode = query?.lang ? normalizeLocale(query.lang) : await getRequestLocale();
  const view = await getObserverAccessView(token);

  if (!view) {
    return (
      <main className="min-h-screen bg-canvas px-4 py-10">
        <section className="mx-auto grid max-w-xl gap-3 rounded-[28px] border border-rose-200 bg-white p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold text-ink">ไม่สามารถเปิดลิงก์ติดตามได้</h1>
          <p className="text-sm leading-6 text-ink-soft">ลิงก์อาจหมดอายุ ถูกยกเลิก หรือไม่มีสิทธิ์ดูข้อมูล โปรดติดต่อศูนย์ควบคุมเพื่อขอลิงก์ใหม่</p>
        </section>
      </main>
    );
  }

  return <ObserverTrackView view={view} locale={locale} serverNow={Date.now()} />;
}
