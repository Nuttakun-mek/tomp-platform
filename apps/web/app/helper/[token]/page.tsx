import { cookies } from "next/headers";
import { HELPER_PIN_COOKIE_PREFIX, findProjectHelperToken } from "@/lib/project-helper/tokens";
import { ProjectHelperPinGate } from "@/components/project-helper/project-helper-pin-gate";
import { ProjectHelperView } from "@/components/project-helper/project-helper-view";

export default async function ProjectHelperPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const claim = await findProjectHelperToken(token);
  if (!claim) {
    return (
      <div className="grid min-h-[70vh] content-center gap-2 text-center">
        <h1 className="text-lg font-bold text-ink">ไม่พบลิงก์นี้</h1>
        <p className="mx-auto max-w-sm text-[13px] leading-6 text-ink-soft">ลิงก์อาจถูกยกเลิกแล้ว กรุณาติดต่อผู้จัดการโครงการเพื่อขอลิงก์ใหม่</p>
      </div>
    );
  }

  const store = await cookies();
  const verified = store.get(`${HELPER_PIN_COOKIE_PREFIX}${claim.tokenId}`)?.value === "1";
  if (!verified) return <ProjectHelperPinGate token={token} />;

  return <ProjectHelperView projectId={claim.projectId} profileId={claim.profileId} />;
}
