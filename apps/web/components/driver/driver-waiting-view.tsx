import { CalendarClock, CarFront, RefreshCw, UserRound } from "lucide-react";
import type { DriverWaitingContext } from "@/lib/data/driver-access";

/**
 * The driver is verified and their unit is ready — there is no work on it yet.
 *
 * Crewing a unit issues its QR immediately, so a driver can be holding a printed
 * sheet before anyone has planned their day. The page used to answer that with
 * "ไม่พบงานสำหรับลิงก์นี้", which reads as a broken QR: the driver phones the
 * control room about something that is working exactly as intended.
 *
 * So it says what is true — you are in, your unit is right, the work is not
 * scheduled yet — and shows what it knows so the driver can confirm the sheet in
 * their hand belongs to the vehicle they are standing next to.
 */
export function DriverWaitingView({ context }: { context: DriverWaitingContext }) {
  return (
    <div className="grid min-h-[70vh] content-center gap-4 px-1">
      <div className="grid gap-1 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-operation-soft text-operation">
          <CalendarClock className="h-7 w-7" />
        </span>
        <h1 className="mt-2 text-lg font-bold text-ink">ยืนยันตัวเรียบร้อย รอรับงาน</h1>
        <p className="mx-auto max-w-xs text-[13px] leading-6 text-ink-soft">
          QR ของคุณใช้งานได้ปกติ ศูนย์ควบคุมยังไม่ได้จัดงานให้หน่วยนี้
          เมื่อมีงานเข้ามา หน้านี้จะแสดงรายละเอียดให้ทันที
        </p>
      </div>

      <section className="grid gap-2 rounded-card bg-white p-3 shadow-sm">
        <p className="text-[11px] font-semibold text-ink-faint">{context.projectName}</p>
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-ink px-2 py-1 text-[12px] font-bold text-white">{context.callSign}</span>
          <span className="text-[13px] font-semibold text-ink">หน่วยรถของคุณ</span>
        </div>
        <p className="flex items-center gap-2 text-[13px] text-ink-soft">
          <UserRound className="h-4 w-4 text-ink-faint" /> {context.driverName}
        </p>
        <p className="flex items-center gap-2 text-[13px] text-ink-soft">
          <CarFront className="h-4 w-4 text-ink-faint" /> {context.vehicleLabel}
        </p>
      </section>

      <p className="text-center text-[12px] leading-5 text-ink-faint">
        ตรวจสอบว่าทะเบียนรถตรงกับรถที่คุณอยู่ หากไม่ตรงกรุณาแจ้งศูนย์ควบคุมก่อนเริ่มงาน
      </p>

      {/* A plain reload: the driver will press something, and refreshing is the
          honest action rather than leaving them to guess. */}
      <form>
        <button
          type="submit"
          className="flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-operation px-4 py-3.5 text-[15px] font-bold text-white"
        >
          <RefreshCw className="h-4 w-4" /> ตรวจสอบงานใหม่
        </button>
      </form>
    </div>
  );
}
