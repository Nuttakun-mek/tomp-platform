"use client";

import { useActionState } from "react";
import { RotateCcw } from "lucide-react";
import { restoreAirportTransferCase, type CaseLifecycleState } from "@/app/airport-transfer/actions";
import { Button } from "@/components/ui/button";

const initialState: CaseLifecycleState = { ok: false, message: "" };

export function RestoreAirportTransferCaseButton({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState(restoreAirportTransferCase.bind(null, caseId), initialState);
  return <div className="grid justify-items-end gap-1"><form action={action}><Button type="submit" variant="secondary" className="gap-2" disabled={pending}><RotateCcw className="h-4 w-4" />{pending ? "กำลังกู้คืน..." : "กู้คืน"}</Button></form>{state.message ? <span className={`text-xs ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</span> : null}</div>;
}
