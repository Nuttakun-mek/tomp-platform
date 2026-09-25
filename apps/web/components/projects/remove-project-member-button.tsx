"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { UserMinus } from "lucide-react";
import { removeProjectMemberAction } from "@/app/actions/project-members";

// Two taps: the first arms it, the second removes. Leaving the button (blur)
// disarms it, so a stray tap never removes anyone.
export function RemoveProjectMemberButton({ projectId, profileId, systemKey, name }: { projectId: string; profileId: string; systemKey: string; name: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    setError(null);
    startTransition(async () => {
      const result = await removeProjectMemberAction({ projectId, profileId, systemKey });
      if (result.success) router.refresh();
      else setError(result.error || "นำสมาชิกออกไม่สำเร็จ");
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error ? <span className="text-xs font-semibold text-rose-600">{error}</span> : null}
      <button
        type="button"
        onClick={handleClick}
        onBlur={() => setArmed(false)}
        disabled={pending}
        aria-label={`นำ ${name} ออกจากระบบนี้ของโครงการ`}
        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-semibold transition disabled:opacity-50 ${
          armed ? "border-rose-500 bg-rose-500 text-white" : "border-slate-200 text-slate-500 hover:border-rose-300 hover:text-rose-600"
        }`}
      >
        <UserMinus className="h-3.5 w-3.5" />
        {pending ? "กำลังนำออก..." : armed ? "กดยืนยันนำออก" : "นำออก"}
      </button>
    </span>
  );
}
