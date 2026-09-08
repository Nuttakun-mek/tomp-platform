import type { ReactNode } from "react";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-7 lg:py-6">
      {children}
    </main>
  );
}
