"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import type { DriverNotification } from "@tomp/types/domain";
import type { DriverIssueMessage } from "@/lib/data/driver-operations";
import { formatRelativeTh } from "@/lib/format/relative-time-th";

export interface ChatBubble {
  id: string;
  from: "driver" | "centre";
  text: string;
  at: string;
  tone?: "info" | "issue" | "critical";
}

const QUICK_MESSAGES = [
  "ถึงจุดรับแล้ว",
  "กำลังเดินทางไปจุดส่ง",
  "การจราจรหนาแน่น คาดว่าจะล่าช้าประมาณ 15 นาที",
  "ไม่สามารถติดต่อผู้โดยสารได้",
  "ถึงจุดส่งแล้ว"
];

export function buildBubbles(messages: DriverIssueMessage[], notifications: DriverNotification[]): ChatBubble[] {
  const fromDriver: ChatBubble[] = messages.map((m) => ({
    id: `m-${m.id}`,
    from: "driver",
    text: m.text || (m.issueType === "message" ? "(ไม่มีข้อความ)" : m.issueType),
    at: m.at,
    tone: m.issueType === "message" ? "info" : m.severity === "critical" || m.severity === "urgent" ? "critical" : "issue"
  }));
  const fromCentre: ChatBubble[] = notifications.map((n) => ({
    id: `n-${n.id}`,
    from: "centre",
    text: n.body || n.title,
    at: n.createdAt,
    tone: n.priority === "critical" ? "critical" : "info"
  }));
  return [...fromDriver, ...fromCentre].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function DriverChatThread({
  messages,
  notifications,
  onSend,
  sending
}: {
  messages: DriverIssueMessage[];
  notifications: DriverNotification[];
  onSend: (text: string) => void;
  sending: boolean;
}) {
  const [text, setText] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bubbles = useMemo(() => buildBubbles(messages, notifications), [messages, notifications]);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [bubbles.length]);

  // grow the composer with its content, up to ~6 lines (chat-app style)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  function submit() {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText("");
  }

  return (
    <section id="driver-chat" className="grid gap-2.5 rounded-[1.25rem] border border-border/70 bg-white/95 p-3 shadow-[0_10px_28px_rgba(16,32,51,0.07)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold text-ink">ข้อความจากศูนย์ควบคุม</p>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">พร้อมส่งข้อความ</span>
      </div>

      <div className="sticky top-0 z-10 grid gap-2 rounded-[1rem] border border-border/80 bg-white p-2 shadow-sm">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            className="field-input min-h-11 flex-1 resize-none overflow-y-auto rounded-[0.9rem] border-border/80 bg-canvas/70 text-[13px]"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="พิมพ์ข้อความถึงศูนย์ควบคุม"
          />
          <button
            type="button"
            onClick={submit}
            disabled={sending || !text.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.95rem] bg-operation text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
            aria-label="ส่งข้อความ"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid max-h-[52dvh] gap-1.5 overflow-y-auto rounded-[1rem] bg-canvas/80 p-2">
        {bubbles.length ? (
          bubbles.map((b) => (
            <div key={b.id} className={`flex ${b.from === "driver" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-5 shadow-sm ${
                  b.from === "driver"
                    ? "bg-operation text-white"
                    : b.tone === "critical"
                      ? "border border-rose-200 bg-rose-50 text-rose-900"
                      : "border border-border bg-white text-ink"
                }`}
              >
                {b.tone === "issue" && b.from === "driver" ? <span className="font-semibold">[แจ้งปัญหา] </span> : null}
                {b.text}
                <span className={`mt-0.5 block text-[10px] ${b.from === "driver" ? "text-white/70" : "text-ink-faint"}`}>
                  {now ? formatRelativeTh(b.at, now) : "กำลังเตรียมเวลา"}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="px-2 py-5 text-center text-[12px] text-ink-faint">ยังไม่มีข้อความ สามารถส่งข้อความถึงศูนย์ควบคุมได้จากช่องด้านบน</p>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_MESSAGES.map((phrase) => (
          <button
            key={phrase}
            type="button"
            onClick={() => setText(phrase)}
            className="rounded-full border border-border/80 bg-white px-2.5 py-1 text-[12px] font-semibold text-ink-soft shadow-sm transition active:scale-[0.98]"
          >
            {phrase}
          </button>
        ))}
      </div>
    </section>
  );
}
