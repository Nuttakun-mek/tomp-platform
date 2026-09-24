import type { ReactNode } from "react";

// Pages read best at 1400px, but a project's workspace (its boards, map and
// forms) uses the whole screen: the project layout marks itself data-wide.
export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col has-[[data-wide]]:max-w-none gap-4 px-4 py-4 sm:px-6 lg:px-7 lg:py-5">
      {children}
    </main>
  );
}
