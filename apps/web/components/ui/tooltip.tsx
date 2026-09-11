"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TooltipProps = {
  children: ReactNode;
  content: string;
  side?: "top" | "bottom" | "right";
  className?: string;
};

export function Tooltip({ children, content, side = "top", className = "" }: TooltipProps) {
  const id = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [style, setStyle] = useState({ left: 0, top: 0, transform: "translate(-50%, -100%)" });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const maxLeft = Math.max(148, window.innerWidth - 148);
      const center = Math.min(Math.max(rect.left + rect.width / 2, 148), maxLeft);

      if (side === "right") {
        const top = Math.min(Math.max(rect.top + rect.height / 2, 48), window.innerHeight - 48);
        const canOpenRight = rect.right + 292 < window.innerWidth;
        setStyle({
          left: canOpenRight ? rect.right + 10 : Math.max(12, rect.left - 10),
          top,
          transform: canOpenRight ? "translateY(-50%)" : "translate(-100%, -50%)"
        });
        return;
      }

      if (side === "bottom") {
        const opensDown = rect.bottom + 104 < window.innerHeight;
        setStyle({
          left: center,
          top: opensDown ? rect.bottom + 10 : rect.top - 10,
          transform: opensDown ? "translateX(-50%)" : "translate(-50%, -100%)"
        });
        return;
      }

      const opensUp = rect.top > 104;
      setStyle({
        left: center,
        top: opensUp ? rect.top - 10 : rect.bottom + 10,
        transform: opensUp ? "translate(-50%, -100%)" : "translateX(-50%)"
      });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, { capture: true, passive: true });
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, { capture: true });
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, side]);

  return (
    <span
      ref={anchorRef}
      aria-describedby={open ? id : undefined}
      className={`inline-flex min-w-0 ${className}`}
      onBlur={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
      tabIndex={0}
    >
      {children}
      {mounted && open
        ? createPortal(
            <span
              id={id}
              className="pointer-events-none fixed z-[1000] w-max max-w-[280px] rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-left text-xs font-medium leading-5 text-white shadow-[0_18px_48px_rgba(15,23,42,0.28)]"
              role="tooltip"
              style={style}
            >
              {content}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}
