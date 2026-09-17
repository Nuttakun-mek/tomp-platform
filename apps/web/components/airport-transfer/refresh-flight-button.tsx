"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { refreshAirportTransferFlight, type RefreshFlightState } from "@/app/airport-transfer/actions";
import { Button } from "@/components/ui/button";

const initialState: RefreshFlightState = { ok: false, message: "" };

export function RefreshFlightButton({ caseId }: { caseId: string }) {
  const action = refreshAirportTransferFlight.bind(null, caseId);
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <div className="grid justify-items-end gap-2">
      <form action={formAction}>
        <Button type="submit" variant="secondary" className="gap-2" disabled={pending}>
          <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
          {pending ? "กำลังอัปเดต..." : "อัปเดตข้อมูลจาก API"}
        </Button>
      </form>
      {state.message ? <p role="status" className={`max-w-sm text-right text-xs ${state.ok ? "text-emerald-700" : "text-red-700"}`}>{state.message}</p> : null}
    </div>
  );
}
