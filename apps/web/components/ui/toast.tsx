"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";

// One place for transient action feedback. Action surfaces used to each keep a
// local message string with inconsistent placement and timing; this is a shared
// stack with a polite live region so a screen reader announces every result.

export type ToastTone = "success" | "info" | "warning" | "danger";

interface Toast {
  id: number;
  tone: ToastTone;
  text: string;
}

interface ToastApi {
  toast: (text: string, tone?: ToastTone) => void;
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
  warning: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE = {
  success: { cls: "border-emerald-200 bg-emerald-50 text-emerald-900", Icon: CheckCircle2 },
  info: { cls: "border-blue-200 bg-blue-50 text-blue-900", Icon: Info },
  warning: { cls: "border-amber-200 bg-amber-50 text-amber-950", Icon: TriangleAlert },
  danger: { cls: "border-red-200 bg-red-50 text-red-900", Icon: XCircle }
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (text: string, tone: ToastTone) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, tone, text }]);
      window.setTimeout(() => dismiss(id), tone === "danger" ? 8000 : 4500);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast: (text, tone = "info") => push(text, tone),
      success: (text) => push(text, "success"),
      error: (text) => push(text, "danger"),
      info: (text) => push(text, "info"),
      warning: (text) => push(text, "warning")
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end" role="region" aria-label="การแจ้งเตือน">
        <div aria-live="polite" className="sr-only">
          {toasts.map((t) => (
            <span key={t.id}>{t.text}</span>
          ))}
        </div>
        {toasts.map((t) => {
          const { cls, Icon } = TONE[t.tone];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-2xl border px-3 py-2.5 text-sm font-medium shadow-lift ${cls}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 leading-6">{t.text}</span>
              <button type="button" onClick={() => dismiss(t.id)} className="shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100" aria-label="ปิด">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}
