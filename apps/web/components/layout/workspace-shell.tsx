import type { ReactNode } from "react";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto grid w-full max-w-[1560px] gap-7 px-4 py-5 sm:px-6 lg:px-10 lg:py-9">{children}</main>;
}
