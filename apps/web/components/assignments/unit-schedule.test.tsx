// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/assignments", () => ({ setAssignmentOrderAction: vi.fn() }));
vi.mock("@/app/actions/missions", () => ({ updateMissionDutyHoursAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Mission } from "@tomp/types/domain";
import { UnitSchedule, type ScheduleJob } from "./unit-schedule";

afterEach(cleanup);

const mission = {
  id: "m1",
  missionName: "รับส่งแขก VIP",
  missionCode: "M-01",
  plannedStartTime: "2026-10-01T00:00",
  plannedEndTime: "2026-10-03T23:59",
  metadata: { operationStartDate: "2026-10-01", operationEndDate: "2026-10-03" }
} as unknown as Mission;

const job = (id: string, day: string, time: string, order: number): ScheduleJob => ({ id, order, status: "planned", day, time, route: "Mandarin → Bitec", urgent: false });

describe("UnitSchedule", () => {
  it("lists every day of the main job, booked or free, and counts the booked ones", () => {
    render(<UnitSchedule projectId="p1" callSignId="c1" mission={mission} jobs={[job("a", "2026-10-01", "07:00–10:00", 1), job("b", "2026-10-01", "10:00–12:00", 2), job("c", "2026-10-03", "08:00–17:00", 3)]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    // Two jobs on the 1st can swap; that makes the order unsaved.
    fireEvent.click(screen.getAllByLabelText("เลื่อนลง")[0]);
    expect(screen.getByText("บันทึกลำดับ")).toBeTruthy();
    expect(screen.getByText(/มีงาน 2\/3 วัน/)).toBeTruthy();
    expect(screen.getByText("ว่าง")).toBeTruthy();
    expect(screen.getByText("2 งาน")).toBeTruthy();
    // Each day of the main job offers its clock-in/out (none set yet in this fixture).
    expect(screen.getAllByText("ตั้งเวลาเข้า-ออก")).toHaveLength(3);
  });

  it("puts a job outside the main job's days where it can be seen and fixed", () => {
    render(<UnitSchedule projectId="p1" callSignId="c1" mission={mission} jobs={[job("x", "2026-10-09", "08:00–09:00", 1)]} />);
    expect(screen.getByText("นอกช่วงภารกิจหลักหรือยังไม่ระบุวัน")).toBeTruthy();
  });
});
