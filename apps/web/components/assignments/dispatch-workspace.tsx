"use client";

import { useEffect, useMemo, useState } from "react";
import type { Assignment, CallSign, Driver, Mission, Vehicle } from "@tomp/types/domain";
import { CallSignAccessPanel } from "./call-sign-access-panel";
import { MissionAssignmentStep } from "./mission-assignment-step";
import { SetupStep } from "./setup-step";
import type { UnitCredentials } from "./unit-credential-sheet";
import type { ProjectObserverLink } from "@/lib/data/observer-access";
import type { VehicleEvidence } from "@/lib/data/vehicle-evidence";

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
  vehicleEvidence,
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
  vehicleEvidence?: Record<string, VehicleEvidence>;
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

  const callSignsWithMission = callSigns.filter((callSign) => {
    const missionId = (callSign.metadata as Record<string, unknown> | undefined)?.missionId;
    return callSign.status === "active" && typeof missionId === "string" && missionId.length > 0;
  });

  return (
    <>
      <SetupStep
        step="ขั้นที่ 1"
        title="กำหนดภารกิจหลักให้ Call Sign"
        description="เลือก Call Sign ที่เตรียมจากหน้าทรัพยากรโครงการ แล้วผูกเข้ากับภารกิจหลักก่อนเปิดงานย่อย ขั้นนี้ยังไม่ออก QR เพื่อป้องกันการแจกงานก่อนข้อมูลพร้อม"
      >
        <MissionAssignmentStep
          projectId={projectId}
          projectCode={projectCode}
          callSigns={callSigns}
          missions={missions}
          drivers={drivers}
          vehicles={vehicles}
          projectStartDate={projectStartDate}
          projectEndDate={projectEndDate}
        />
      </SetupStep>

      <SetupStep
        step="ขั้นที่ 2"
        title="เปิดงานย่อยให้ Call Sign"
        description="เลือก Call Sign ที่ผ่านขั้นที่ 1 แล้วกำหนดวัน เวลา จุดรับ และจุดส่ง งานย่อยจะเรียงอยู่ในการ์ดของ Call Sign นั้น"
        disabledNote={callSignsWithMission.length ? undefined : "ยังเปิดงานย่อยไม่ได้ ต้องกำหนดภารกิจหลักให้ Call Sign ในขั้นที่ 1 ก่อน"}
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
        vehicleEvidence={vehicleEvidence}
        onIssued={rememberCredentials}
      />
    </>
  );
}
