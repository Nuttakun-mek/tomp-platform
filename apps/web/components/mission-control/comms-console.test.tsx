// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Assignment, CallSign } from "@tomp/types/domain";

const send = vi.fn(async (input: unknown) => ({ success: Boolean(input) }));
vi.mock("@/app/actions/driver-notifications", () => ({ sendDriverNotificationAction: (input: unknown) => send(input) }));
vi.mock("./fleet-board", () => ({ OPEN_COMMS_EVENT: "tomp:open-comms" }));

const inbound = [
  { id: "m1", assignmentId: "job-1", driverId: "d1", issueType: "message", severity: "info", message: "ถึงจุดรับแล้ว", status: "open", at: "2026-09-30T11:05:00Z", kind: "message" as const },
  { id: "m2", assignmentId: "job-2", driverId: "d1", issueType: "message", severity: "info", message: "ข้อความเก่าหาย", status: "open", at: "2026-09-30T12:40:00Z", kind: "message" as const }
];
vi.mock("./mission-control-feed", () => ({
  useMissionControlFeed: () => ({ comms: { inbound, outbound: [] }, now: Date.parse("2026-09-30T12:45:00Z") })
}));

Element.prototype.scrollIntoView = vi.fn();

const { CommsConsole } = await import("./comms-console");

const job = (id: string, status: string, startTime: string) =>
  ({ id, callSignId: "cs-van01", driverId: "d1", status, startTime, createdAt: "2026-09-30T00:00:00Z" }) as unknown as Assignment;
const callSigns = [{ id: "cs-van01", callSign: "Van-01" }] as unknown as CallSign[];

afterEach(() => {
  cleanup();
  send.mockClear();
});

describe("CommsConsole", () => {
  it("keeps one thread per Call Sign across its jobs, and replies to the job the driver is on", () => {
    const assignments = [job("job-1", "completed", "2026-09-30T11:00:00Z"), job("job-2", "active", "2026-09-30T12:00:00Z")];
    render(<CommsConsole projectId="p1" assignments={assignments} callSigns={callSigns} />);

    const chips = screen.getAllByRole("button", { name: "Van-01" });
    expect(chips).toHaveLength(1);
    fireEvent.click(chips[0]);
    expect(screen.getByText("ถึงจุดรับแล้ว")).toBeTruthy();
    expect(screen.getByText("ข้อความเก่าหาย")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("พิมพ์ข้อความถึงคนขับ…"), { target: { value: "รับทราบ" } });
    fireEvent.click(screen.getByRole("button", { name: /ส่งข้อความ/ }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ assignmentId: "job-2" }));
  });
});
