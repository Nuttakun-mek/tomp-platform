// @vitest-environment jsdom
//
// The job-to-job flow: a closed job does not hand its ticks to the next one,
// the next one is started from the plan tab, and a finished day is an empty page.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { DriverAccessAssignment } from "@/lib/data/driver-access";
import { buildDriverAccess } from "./test-fixtures";

const statusUpdate = vi.fn(async (input: unknown) => ({ success: Boolean(input) }));
vi.mock("@/app/actions/driver", () => ({
  assignmentStatusUpdateAction: (input: unknown) => statusUpdate(input),
  driverIssueReportAction: vi.fn(async () => ({ success: true }))
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push }) }));

const { DriverTaskView } = await import("./driver-task-view");

const day = (current: "job-1" | "job-2", job1Status: string, job2Status: string): DriverAccessAssignment["dayAssignments"] => [
  { assignmentId: "job-1", callSign: "Van-01", pickup: "PEA HQ", dropoff: "สนามกอล์ฟ", startTime: "2026-09-30T11:00:00Z", endTime: "2026-09-30T12:00:00Z", status: job1Status, isCurrent: current === "job-1", sequence: 1, isNext: false, urgent: false },
  { assignmentId: "job-2", callSign: "Van-01", pickup: "บ้านเบญจวรรณ คอนโด", dropoff: "สนามกอล์ฟ บางกอก", startTime: "2026-09-30T12:00:00Z", endTime: "2026-09-30T14:00:00Z", status: job2Status, isCurrent: current === "job-2", sequence: 2, isNext: current === "job-1", urgent: false }
];

function job1Done(): DriverAccessAssignment {
  const access = buildDriverAccess();
  return {
    ...access,
    assignment: { ...access.assignment, id: "job-1", status: "completed" },
    latestStatus: { status: "completed", at: "2026-09-30T12:00:00Z" },
    dayAssignments: day("job-1", "completed", "planned")
  };
}

function job2Waiting(): DriverAccessAssignment {
  const access = buildDriverAccess();
  return {
    ...access,
    assignment: {
      ...access.assignment,
      id: "job-2",
      status: "planned",
      metadata: { pickupLocation: "บ้านเบญจวรรณ คอนโด", dropoffLocation: "สนามกอล์ฟ บางกอก" }
    },
    latestStatus: null,
    dayAssignments: day("job-2", "completed", "planned")
  };
}

afterEach(() => {
  cleanup();
  statusUpdate.mockClear();
  push.mockClear();
  vi.unstubAllGlobals();
});

describe("DriverTaskView job-to-job flow", () => {
  it("does not carry a closed job's ticks onto the next job when the page moves on", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { rerender } = render(<DriverTaskView driverAccess={job1Done()} view="home" />);
    rerender(<DriverTaskView driverAccess={job2Waiting()} view="home" />);

    expect(screen.getByText("ยังไม่ได้เริ่มงานถัดไป")).toBeTruthy();
    expect(screen.queryByText("งานนี้เสร็จสิ้นแล้ว")).toBeNull();
    expect(screen.queryByText("เสร็จสิ้นงาน")).toBeNull();
    // Not on home until started.
    expect(screen.queryByText(/บ้านเบญจวรรณ คอนโด/)).toBeNull();
  });

  it("starts the chosen job from the plan tab", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<DriverTaskView driverAccess={job2Waiting()} view="next" />);

    fireEvent.click(screen.getByRole("button", { name: /เริ่มงานนี้/ }));

    expect(statusUpdate).toHaveBeenCalledWith(expect.objectContaining({ assignmentId: "job-2", status: "acknowledged" }));
  });

  it("offers no start while a job is under way", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const access = buildDriverAccess();
    render(
      <DriverTaskView
        driverAccess={{ ...access, assignment: { ...access.assignment, id: "job-1", status: "active" }, dayAssignments: day("job-1", "active", "planned") }}
        view="next"
      />
    );
    expect((screen.getByRole("button", { name: /เริ่มงานนี้/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows an empty, finished day once the last job has closed", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const access = job1Done();
    render(<DriverTaskView driverAccess={{ ...access, dayAssignments: day("job-1", "completed", "completed") }} view="home" />);

    expect(screen.getByText("งานวันนี้เสร็จครบแล้ว")).toBeTruthy();
    expect(screen.queryByText(/PEA HQ|สนามบินสุวรรณภูมิ/)).toBeNull();
  });
});
