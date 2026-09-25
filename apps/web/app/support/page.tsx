import type { Metadata } from "next";
import Link from "next/link";
import { SERVICE_OPERATOR as op } from "@/lib/legal/operator";

export const metadata: Metadata = { title: "Support · TOMP" };

const mail = <a className="font-semibold text-operation underline" href={`mailto:${op.contactEmail}`}>{op.contactEmail}</a>;

// Public, no sign-in: App Store Connect links here as the app's support URL.
export default function SupportPage() {
  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-5 py-10 text-ink">
      <header className="grid gap-1">
        <p className="section-label">{op.appName}</p>
        <h1 className="page-title">ช่วยเหลือ · Support</h1>
      </header>

      <section lang="th" className="grid gap-3 text-[15px] leading-7">
        <h2 className="section-title">เริ่มใช้งาน</h2>
        <ol className="list-decimal space-y-1 pl-6">
          <li>รับ QR หรือลิงก์งานจากศูนย์ควบคุมของผู้จัดงาน</li>
          <li>เปิดแอปแล้วสแกน QR จากนั้นกรอก PIN ที่ได้รับ</li>
          <li>อนุญาตตำแหน่งและกล้องเมื่อแอปถาม เพื่อให้ศูนย์ควบคุมเห็นรถของคุณ</li>
        </ol>
        <p>เรื่องงาน เวลา หรือเส้นทาง ติดต่อศูนย์ควบคุมของงานนั้นผ่านปุ่มโทรหรือข้อความในแอป</p>
        <p>ปัญหาของแอปหรือเรื่องข้อมูลส่วนบุคคล: {mail}</p>
      </section>

      <section lang="en" className="grid gap-3 text-[15px] leading-7">
        <h2 className="section-title">Getting started</h2>
        <ol className="list-decimal space-y-1 pl-6">
          <li>Get a job QR code or link from the organiser&apos;s control room.</li>
          <li>Open the app, scan the QR code, then enter the PIN you were given.</li>
          <li>Allow location and camera access when asked, so the control room can see your vehicle.</li>
        </ol>
        <p>For anything about the job itself — times, routes, passengers — contact that job&apos;s control room with the call or message button in the app.</p>
        <p>App problems or privacy requests: {mail}</p>
      </section>

      <p className="text-sm text-ink-soft">
        <Link className="underline" href="/privacy">
          นโยบายความเป็นส่วนตัว · Privacy Policy
        </Link>
      </p>
    </main>
  );
}
