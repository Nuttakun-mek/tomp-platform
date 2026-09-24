import type { ReactNode } from "react";

// Full width is the standard for every page (decided 2026-09-24): a cap made
// pages change width as you moved between them.
export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex w-full min-w-0 flex-col gap-4 px-4 py-4 sm:px-6 lg:px-7 lg:py-5">
      {children}
    </main>
  );
}
