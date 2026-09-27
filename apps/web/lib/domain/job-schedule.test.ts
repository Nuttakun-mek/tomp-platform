import { describe, expect, it } from "vitest";
import { bangkokDateOf, checkMainJobDays, checkSubJob } from "./job-schedule";

// Bangkok is UTC+7, so 08:00 Bangkok is 01:00Z.
const bkk = (date: string, clock: string) => new Date(`${date}T${clock}:00+07:00`).toISOString();
const project = { startDate: "2026-10-01", endDate: "2026-10-05" };
const mainJob = { from: "2026-10-02", to: "2026-10-03" };

describe("checkMainJobDays", () => {
  it("accepts a range inside the project and rejects one that spills out", () => {
    expect(checkMainJobDays({ from: "2026-10-01", to: "2026-10-05" }, project)).toBeNull();
    expect(checkMainJobDays({ from: "2026-09-30", to: "2026-10-02" }, project)).toContain("ก่อนวันเริ่มโครงการ");
    expect(checkMainJobDays({ from: "2026-10-04", to: "2026-10-06" }, project)).toContain("หลังวันสิ้นสุดโครงการ");
    expect(checkMainJobDays({ from: "2026-10-03", to: "2026-10-02" }, project)).toContain("ก่อนวันที่เริ่ม");
  });
});

describe("checkSubJob", () => {
  const base = { mainJob, project };

  it("allows a job to start exactly when the previous one ended", () => {
    const others = [{ label: "A", startTime: bkk("2026-10-02", "08:00"), endTime: bkk("2026-10-02", "10:00") }];
    expect(checkSubJob({ ...base, startTime: bkk("2026-10-02", "10:00"), endTime: bkk("2026-10-02", "12:00"), others })).toEqual([]);
  });

  it("rejects any overlap and names the job it hits, in Bangkok time", () => {
    const others = [{ label: "A", startTime: bkk("2026-10-02", "08:00"), endTime: bkk("2026-10-02", "10:00") }];
    const problems = checkSubJob({ ...base, startTime: bkk("2026-10-02", "09:30"), endTime: bkk("2026-10-02", "11:00"), others });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("ทับเวลากับงาน A");
    expect(problems[0]).toContain("08:00–10:00");
  });

  it("rejects an end at or before the start", () => {
    expect(checkSubJob({ ...base, startTime: bkk("2026-10-02", "10:00"), endTime: bkk("2026-10-02", "10:00"), others: [] })).toEqual([
      "เวลาจบต้องอยู่หลังเวลาเริ่ม"
    ]);
  });

  it("keeps the job inside the main job's days, judged on the Bangkok calendar", () => {
    // 06:00 on 2 Oct in Bangkok is still 1 Oct in UTC — it must count as the 2nd.
    expect(bangkokDateOf(bkk("2026-10-02", "06:00"))).toBe("2026-10-02");
    expect(checkSubJob({ ...base, startTime: bkk("2026-10-02", "06:00"), endTime: bkk("2026-10-02", "07:00"), others: [] })).toEqual([]);
    expect(checkSubJob({ ...base, startTime: bkk("2026-10-04", "08:00"), endTime: bkk("2026-10-04", "09:00"), others: [] })[0]).toContain(
      "ช่วงของภารกิจหลัก"
    );
  });
});
