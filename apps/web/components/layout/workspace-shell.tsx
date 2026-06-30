import type { ReactNode } from "react";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto grid w-full max-w-[1520px] gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>;
}
