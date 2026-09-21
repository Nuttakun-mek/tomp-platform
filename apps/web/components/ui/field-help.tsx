"use client";

import { HelpCircle } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

export function FieldHelp({ content, label = "คำอธิบายเพิ่มเติม" }: { content: string; label?: string }) {
  return (
    <Tooltip content={content} side="bottom">
      <span
        aria-label={label}
        className="inline-grid h-5 w-5 shrink-0 place-items-center rounded-full border border-border bg-white text-ink-faint shadow-sm transition hover:border-operation/40 hover:text-operation"
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </Tooltip>
  );
}
