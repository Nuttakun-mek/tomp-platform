import type { ReactNode } from "react";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto grid w-full max-w-[1480px] gap-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>;
}
