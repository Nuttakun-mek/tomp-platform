import Link from "next/link";
import { Apple } from "lucide-react";

// The Apple reviewer's demo job lives in a real project, now listed with the
// rest. This banner is what keeps someone from treating it as one of theirs:
// opening its driver link or entering its PIN binds the job to that device and
// locks the reviewer out, and deleting it ends the review.
export function AppleReviewBanner() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm text-violet-900">
      <Apple className="h-4 w-4 shrink-0" />
      <span className="font-semibold">โครงการทดสอบสำหรับผู้ตรวจของ Apple</span>
      <span className="text-violet-800">ห้ามเปิดลิงก์คนขับหรือกรอก PIN ของงานนี้ และห้ามลบโครงการระหว่างรอรีวิว</span>
      <Link href="/ground-transfer/superadmin/dev-tools/apple-review" className="font-semibold underline">
        จัดการงานทดสอบ
      </Link>
    </div>
  );
}
