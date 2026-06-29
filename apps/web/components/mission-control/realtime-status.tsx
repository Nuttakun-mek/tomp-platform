"use client";

export function RealtimeStatus({ state = "Fallback" }: { state?: "Live" | "Fallback" | "Offline" }) {
  const tone = state === "Live" ? "border-teal-200 bg-teal-50 text-teal-800" : state === "Offline" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800";
  const label = state === "Live" ? "เชื่อมต่อสด" : state === "Offline" ? "ออฟไลน์" : "โหมดสำรอง";
  return <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}
