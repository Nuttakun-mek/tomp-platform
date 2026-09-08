import type { ReactNode } from "react";

type TooltipProps = {
  children: ReactNode;
  content: string;
  side?: "top" | "bottom" | "right";
  className?: string;
};

export function Tooltip({ children, content, side = "top", className = "" }: TooltipProps) {
  const positionClass =
    side === "right"
      ? "left-full top-1/2 ml-2 -translate-y-1/2"
      : side === "bottom"
        ? "left-1/2 top-full mt-2 -translate-x-1/2"
        : "bottom-full left-1/2 mb-2 -translate-x-1/2";

  return (
    <span className={`group/tooltip relative inline-flex min-w-0 ${className}`} tabIndex={0}>
      {children}
      <span
        className={`pointer-events-none absolute z-50 hidden w-max max-w-[260px] rounded-xl border border-slate-200 bg-slate-950 px-3 py-2 text-left text-xs font-medium leading-5 text-white shadow-xl group-hover/tooltip:block group-focus/tooltip:block ${positionClass}`}
        role="tooltip"
      >
        {content}
      </span>
    </span>
  );
}
