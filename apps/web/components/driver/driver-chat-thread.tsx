"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import type { DriverNotification } from "@tomp/types/domain";
import type { DriverIssueMessage } from "@/lib/data/driver-operations";
import { formatRelativeTh } from "@/lib/ui/relative-time";

export interface ChatBubble {
  id: string;
  from: "driver" | "centre";
  text: string;
  at: string;
  tone?: "info" | "issue" | "critical";
}

const QUICK_MESSAGES = ["ถึงจุดรับแล้ว", "กำลังไปจุดส่ง", "รถติด คาดว่าช้า ~15 นาที", "ติดต่อผู้โดยสารไม่ได้", "ถึงจุดส่งแล้ว"];

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
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bubbles = useMemo(() => buildBubbles(messages, notifications), [messages, notifications]);
  const now = Date.now();

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
    <section id="driver-chat" className="grid gap-2 rounded-card border border-border bg-white p-3">
      <p className="text-[13px] font-bold text-ink">แชทกับศูนย์ควบคุม</p>

      <div className="grid max-h-64 gap-1.5 overflow-y-auto rounded-card bg-canvas p-2">
        {bubbles.length ? (
          bubbles.map((b) => (
            <div key={b.id} className={`flex ${b.from === "driver" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-[13px] leading-5 ${
                  b.from === "driver"
                    ? "bg-operation text-white"
                    : b.tone === "critical"
                      ? "border border-rose-200 bg-rose-50 text-rose-900"
                      : "border border-border bg-white text-ink"
                }`}
              >
                {b.tone === "issue" && b.from === "driver" ? <span className="font-semibold">[แจ้งปัญหา] </span> : null}
                {b.text}
                <span className={`mt-0.5 block text-[10px] ${b.from === "driver" ? "text-white/70" : "text-ink-faint"}`}>{formatRelativeTh(b.at, now)}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="px-2 py-6 text-center text-[12px] text-ink-faint">ยังไม่มีข้อความ พิมพ์ด้านล่างเพื่อคุยกับศูนย์ควบคุม</p>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_MESSAGES.map((phrase) => (
          <button
            key={phrase}
            type="button"
            onClick={() => setText(phrase)}
            className="rounded-full border border-border bg-white px-2.5 py-1 text-[12px] font-medium text-ink-soft"
          >
            {phrase}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          className="field-input min-h-11 flex-1 resize-none overflow-y-auto"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="พิมพ์ข้อความ…"
        />
        <button
          type="button"
          onClick={submit}
          disabled={sending || !text.trim()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-command bg-operation text-white disabled:opacity-50"
          aria-label="ส่งข้อความ"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
