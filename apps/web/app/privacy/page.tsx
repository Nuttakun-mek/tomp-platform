import type { Metadata } from "next";
import { SERVICE_OPERATOR as op } from "@/lib/legal/operator";

export const metadata: Metadata = { title: "Privacy Policy · TOMP" };

const mail = <a className="font-semibold text-operation underline" href={`mailto:${op.contactEmail}`}>{op.contactEmail}</a>;

// Public, no sign-in: App Store Connect links here as the app's privacy policy.
// Thai first for the drivers, English for Apple's reviewer and anyone else.
export default function PrivacyPage() {
  return (
    <main className="mx-auto grid max-w-3xl gap-10 px-5 py-10 text-ink">
      <header className="grid gap-1">
        <p className="section-label">{op.platformName}</p>
        <h1 className="page-title">นโยบายความเป็นส่วนตัว · Privacy Policy</h1>
        <p className="text-sm text-ink-soft">มีผลตั้งแต่ / Effective {op.policyEffectiveDate}</p>
      </header>

      <section lang="th" className="grid gap-4 text-[15px] leading-7">
        <p>
          {op.appName} และระบบ {op.platformName} ให้บริการโดย {op.name} (&quot;ผู้ให้บริการ&quot;) ใช้สำหรับบริหารงานรับส่งและติดตามรถระหว่างปฏิบัติงาน
          แอปนี้ใช้เฉพาะคนขับที่ได้รับงานจากผู้จัดงานเท่านั้น
        </p>
        <h2 className="section-title">ข้อมูลที่เก็บ</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>ข้อมูลงานที่ผู้จัดงานบันทึก: ชื่อและเบอร์โทรคนขับ ข้อมูลรถ และรายละเอียดงาน</li>
          <li>ตำแหน่งแบบละเอียด (พิกัด ความแม่นยำ เวลา) เฉพาะระหว่างที่มีงานและคนขับเปิดส่งตำแหน่ง รวมถึงตอนแอปอยู่เบื้องหลังหากคนขับอนุญาต</li>
          <li>รูปถ่ายที่คนขับถ่ายในแอป เช่น รูปรถ ป้ายทะเบียน และหลักฐานการปฏิบัติงาน</li>
          <li>ข้อความ สถานะงาน และการแจ้งปัญหาที่ส่งถึงศูนย์ควบคุม</li>
          <li>รหัสเครื่องแบบสุ่มที่แอปสร้างขึ้นเพื่อผูกงานกับเครื่อง และโทเคนสำหรับส่งการแจ้งเตือน</li>
          <li>รายงานข้อผิดพลาดของแอป (ถ้าเปิดใช้) เพื่อใช้แก้ไขปัญหา</li>
        </ul>
        <h2 className="section-title">ใช้ข้อมูลเพื่ออะไร</h2>
        <p>
          ใช้เพื่อให้ศูนย์ควบคุมมอบหมายงาน ติดตามตำแหน่งรถ ติดต่อคนขับ และจัดทำรายงานการปฏิบัติงานเท่านั้น ไม่ขายข้อมูล ไม่ใช้โฆษณา
          และไม่ติดตามผู้ใช้ข้ามแอปหรือเว็บไซต์อื่น
        </p>
        <h2 className="section-title">ใครเห็นข้อมูล</h2>
        <p>
          เจ้าหน้าที่ของผู้จัดงานที่มีสิทธิ์ในโครงการนั้น และผู้ให้บริการระบบที่จำเป็นต่อการทำงาน ได้แก่ ที่เก็บข้อมูล (Supabase) เว็บโฮสติ้ง (Vercel)
          บริการแจ้งเตือน (Apple, Expo) และบริการรายงานข้อผิดพลาด (Sentry)
        </p>
        <h2 className="section-title">การเก็บรักษาและสิทธิ์ของคุณ</h2>
        <p>
          ข้อมูลเก็บไว้ตลอดช่วงงานและเพื่อรายงานของผู้จัดงาน และถูกลบเมื่อผู้จัดงานลบโครงการ หรือเมื่อคุณขอให้ลบ คุณหยุดส่งตำแหน่งได้ทุกเมื่อในแอป
          หรือปิดสิทธิ์ตำแหน่งในการตั้งค่าของเครื่อง และมีสิทธิ์ขอเข้าถึง แก้ไข หรือลบข้อมูลส่วนบุคคลตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
        </p>
        <p>ติดต่อ: {mail}</p>
      </section>

      <hr className="border-border" />

      <section lang="en" className="grid gap-4 text-[15px] leading-7">
        <p>
          {op.appName} and the {op.platformName} platform are operated by {op.name} (&quot;we&quot;). They are used to run ground-transport jobs and to
          follow vehicles while they are working. The app is only for drivers who have been given a job by an event organiser.
        </p>
        <h2 className="section-title">What we collect</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Job details entered by the organiser: the driver&apos;s name and phone number, vehicle details and the job itself.</li>
          <li>
            Precise location (coordinates, accuracy, time), only while the driver has a job and has turned location sharing on — including in the
            background if the driver allows it.
          </li>
          <li>Photos the driver takes in the app, such as the vehicle, its licence plate and proof of work.</li>
          <li>Messages, job status updates and problem reports sent to the control room.</li>
          <li>A random identifier the app creates to bind a job to one device, and a push-notification token.</li>
          <li>Crash reports (when enabled), used to fix errors.</li>
        </ul>
        <h2 className="section-title">How we use it</h2>
        <p>
          Only to let the control room assign jobs, see where vehicles are, contact drivers and report on the operation. We do not sell data, show
          advertising, or track anyone across other apps or websites.
        </p>
        <h2 className="section-title">Who can see it</h2>
        <p>
          The organiser&apos;s staff who have access to that project, and the providers the service runs on: database (Supabase), web hosting (Vercel),
          notifications (Apple, Expo) and crash reporting (Sentry).
        </p>
        <h2 className="section-title">Retention and your rights</h2>
        <p>
          Data is kept for the duration of the job and the organiser&apos;s reporting, and is deleted when the organiser deletes the project or when you
          ask us to. You can stop sharing your location at any time in the app, or turn off location access in your device settings. You may ask to
          access, correct or delete your personal data under Thailand&apos;s Personal Data Protection Act B.E. 2562 (2019).
        </p>
        <p>Contact: {mail}</p>
      </section>
    </main>
  );
}
