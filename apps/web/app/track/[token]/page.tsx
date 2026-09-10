import Link from "next/link";
import { MapPin, Navigation, ShieldCheck } from "lucide-react";
import { getObserverAccessView } from "@/lib/data/observer-access";
import { formatStatusTh } from "@/lib/i18n/status-th";

interface TrackPageProps {
  params: Promise<{ token: string }>;
}

function formatTime(value: string | null) {
  if (!value) return "ยังไม่มีข้อมูล";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok"
  }).format(new Date(value));
}

export default async function ObserverTrackPage({ params }: TrackPageProps) {
  const { token } = await params;
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

  const mapsUrl = view.location?.latitude && view.location.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${view.location.latitude},${view.location.longitude}`
    : null;

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 sm:py-10">
      <section className="mx-auto grid max-w-4xl gap-4">
        <header className="rounded-[28px] border border-white/70 bg-command p-5 text-white shadow-command">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">TOMP / หน้าติดตามแบบอ่านอย่างเดียว</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">Call Sign {view.callSign.label}</h1>
              <p className="mt-1 text-sm text-slate-200">{view.project.name} / {view.project.code}</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-teal-100">
              <ShieldCheck className="h-4 w-4" />
              สิทธิ์อ่านอย่างเดียว
            </span>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <section className="overflow-hidden rounded-[28px] border border-border bg-white shadow-soft">
            <div className="border-b border-border px-5 py-4">
              <p className="text-sm font-bold text-ink">พิกัดล่าสุด</p>
              <p className="text-xs text-ink-faint">แสดงสถานะล่าสุดที่คนขับส่งเข้าระบบ</p>
            </div>
            <div className="grid min-h-[320px] place-items-center bg-[linear-gradient(135deg,#e9f3f1,#f8fafc)] p-5">
              {view.location?.latitude && view.location.longitude ? (
                <div className="grid gap-3 text-center">
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-operation text-white shadow-soft">
                    <MapPin className="h-8 w-8" />
                  </span>
                  <p className="text-2xl font-bold text-ink">{view.location.latitude.toFixed(6)}, {view.location.longitude.toFixed(6)}</p>
                  <p className="text-sm text-ink-soft">อัปเดตล่าสุด {formatTime(view.location.recordedAt)}</p>
                  {mapsUrl ? (
                    <Link href={mapsUrl} target="_blank" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-command bg-route px-5 text-sm font-bold text-white">
                      <Navigation className="h-4 w-4" />
                      เปิดบน Google Maps
                    </Link>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-2 text-center">
                  <MapPin className="mx-auto h-10 w-10 text-ink-faint" />
                  <p className="font-semibold text-ink">ยังไม่มีพิกัดล่าสุด</p>
                  <p className="text-sm text-ink-soft">รอให้คนขับเปิดแชร์ GPS จากหน้า driver หรือ mobile app</p>
                </div>
              )}
            </div>
          </section>

          <aside className="grid gap-4">
            <section className="rounded-[28px] border border-border bg-white p-5 shadow-soft">
              <p className="text-sm font-bold text-ink">ข้อมูลรถ</p>
              <div className="mt-3 grid gap-2 text-sm text-ink-soft">
                <p><span className="font-semibold text-ink">ทะเบียน</span> / {view.vehicle?.plateNumber || "ยังไม่ระบุ"}</p>
                <p><span className="font-semibold text-ink">ประเภทรถ</span> / {view.vehicle?.vehicleType || "ยังไม่ระบุ"}</p>
                <p><span className="font-semibold text-ink">สถานะงาน</span> / {formatStatusTh(view.assignment?.status || "planned")}</p>
              </div>
            </section>

            <section className="rounded-[28px] border border-border bg-white p-5 shadow-soft">
              <p className="text-sm font-bold text-ink">เส้นทางงานปัจจุบัน</p>
              {view.assignment ? (
                <div className="mt-3 grid gap-2 text-sm text-ink-soft">
                  <p><span className="font-semibold text-ink">จุดรับ</span> / {view.assignment.pickup}</p>
                  <p><span className="font-semibold text-ink">จุดส่ง</span> / {view.assignment.dropoff}</p>
                  <p><span className="font-semibold text-ink">เวลา</span> / {formatTime(view.assignment.startTime)}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-ink-soft">ยังไม่มีงานที่เปิดให้ติดตาม</p>
              )}
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
