"use client";

import { useEffect, useMemo, useState } from "react";
import type { Assignment, CallSign, Driver, Mission, Vehicle } from "@tomp/types/domain";
import { CallSignAccessPanel } from "./call-sign-access-panel";
import { SetupStep } from "./setup-step";
import { UnitSetupForm } from "./unit-setup-form";
import type { UnitCredentials } from "./unit-credential-sheet";
import type { ProjectObserverLink } from "@/lib/data/observer-access";

// Holds the one thing the setup form and the unit list have to agree on: the
// credentials just issued.
//
// The PIN exists in memory and nowhere else — it is stored as a hash, so a
// refresh loses it for good. The form is where it is created and the unit's own
// card is where it belongs, so it is handed across here rather than shown inside
// the form, which is what put a QR block in the middle of an empty form.

export function DispatchWorkspace({
  projectId,
  projectCode,
  callSigns,
  missions,
  drivers,
  vehicles,
  assignments,
  observerLinks,
  projectObserverLink,
  projectStartDate,
  projectEndDate,
  jobForm
}: {
  projectId: string;
  projectCode: string;
  callSigns: CallSign[];
  missions: Mission[];
  drivers: Driver[];
  vehicles: Vehicle[];
  assignments: Assignment[];
  /** Live passenger links per call sign, read on the server so the QR survives a reload. */
  observerLinks?: Record<string, string>;
  /** Live customer fleet link for the whole project. */
  projectObserverLink?: ProjectObserverLink | null;
  projectStartDate?: string | null;
  projectEndDate?: string | null;
  /** Step 2, rendered between the setup card and the unit list it feeds. */
  jobForm: React.ReactNode;
}) {
  const storageKey = useMemo(() => `tomp.unitCredentials.${projectId}`, [projectId]);
  const [issued, setIssued] = useState<Record<string, UnitCredentials>>({});

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, UnitCredentials>;
      if (parsed && typeof parsed === "object") setIssued(parsed);
    } catch {
      window.sessionStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  function rememberCredentials(credentials: UnitCredentials) {
    setIssued((current) => {
      const next = { ...current, [credentials.callSignId]: credentials };
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // The sheet stays in memory even if the browser refuses session storage.
      }
      return next;
    });
  }

  return (
    <>
      <SetupStep
        step="ขั้นที่ 1"
        title="สร้างหน่วยรถ พร้อมภารกิจและ QR"
        description="กรอกครั้งเดียวจบ — คนขับ รถ ภารกิจ และช่วงวัน เมื่อบันทึกแล้วระบบจะออก QR คนขับพร้อมรหัส และ QR ผู้โดยสาร/ผู้ติดตามให้ทันที"
      >
        <UnitSetupForm
          projectId={projectId}
          projectCode={projectCode}
          callSigns={callSigns}
          missions={missions}
          drivers={drivers}
          vehicles={vehicles}
          projectStartDate={projectStartDate}
          projectEndDate={projectEndDate}
          onIssued={rememberCredentials}
        />
      </SetupStep>

      <SetupStep
        step="ขั้นที่ 2"
        title="เปิดงานใหม่ให้หน่วยรถ"
        description="เลือกหน่วยที่จัดไว้ในขั้นที่ 1 แล้วกำหนดเวลาและจุดรับ-ส่ง งานจะไปอยู่ในการ์ดของหน่วยนั้น เรียงตามเวลาที่ถึงก่อน-หลัง"
        disabledNote={callSigns.length ? undefined : "ยังทำขั้นนี้ไม่ได้ — สร้างหน่วยรถในขั้นที่ 1 ก่อน"}
      >
        {jobForm}
      </SetupStep>

      <CallSignAccessPanel
        projectId={projectId}
        assignments={assignments}
        callSigns={callSigns}
        drivers={drivers}
        vehicles={vehicles}
        issued={issued}
        observerLinks={observerLinks}
        projectObserverLink={projectObserverLink}
        onIssued={rememberCredentials}
      />
    </>
  );
}
