"use client";

import { MessageSquare } from "lucide-react";
import { useMissionControlFeed } from "./mission-control-feed";

/**
 * Phones and tablets stack the control room in one long column, with the chat
 * at the bottom. This keeps it one tap away, with the count of messages still
 * waiting for an answer.
 */
export function CommsJumpButton() {
  const { comms } = useMissionControlFeed();
  const waiting = comms.inbound.filter((message) => message.status !== "closed").length;
  return (
    <button
      type="button"
      onClick={() => document.getElementById("mission-comms")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      className="fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-command px-4 py-3 text-sm font-semibold text-white shadow-command lg:hidden"
      aria-label={waiting ? `ไปที่แชท มี ${waiting} ข้อความรอตอบ` : "ไปที่แชท"}
    >
      <MessageSquare className="h-4 w-4" />
      แชท
      {waiting ? <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-bold">{waiting}</span> : null}
    </button>
  );
}
