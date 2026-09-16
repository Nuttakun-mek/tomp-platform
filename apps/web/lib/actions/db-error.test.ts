import { describe, expect, it } from "vitest";
import { getDatabaseErrorMessage } from "./db-error";

const duplicate = (constraint: string) => ({
  code: "23505",
  message: `duplicate key value violates unique constraint "${constraint}"`
});

describe("getDatabaseErrorMessage", () => {
  it("tells the operator to reissue when a live passenger link holds the unit's slot", () => {
    expect(getDatabaseErrorMessage(duplicate("observer_access_tokens_one_active_per_call_sign_idx"))).toBe(
      "หน่วยรถนี้มีลิงก์ติดตามที่ยังใช้งานอยู่ กดออกลิงก์ใหม่เพื่อแทนที่ลิงก์เดิม"
    );
  });

  it("says the same for the project-wide tracking link", () => {
    expect(getDatabaseErrorMessage(duplicate("observer_access_tokens_one_active_per_project_idx"))).toBe(
      "โครงการนี้มีลิงก์ติดตามทั้งโครงการที่ยังใช้งานอยู่ กดออกลิงก์ใหม่เพื่อแทนที่ลิงก์เดิม"
    );
  });

  it("never tells the operator to change a credential to another value", () => {
    for (const constraint of [
      "observer_access_tokens_one_active_per_call_sign_idx",
      "observer_access_tokens_one_active_per_project_idx",
      "driver_access_tokens_one_active_per_call_sign_idx"
    ]) {
      expect(getDatabaseErrorMessage(duplicate(constraint))).not.toContain("กรุณาเปลี่ยนเป็นค่าอื่น");
    }
  });

  it("reads the constraint out of details as well as message", () => {
    expect(
      getDatabaseErrorMessage({
        code: "23505",
        message: "duplicate key value violates unique constraint",
        details: "Key (call_sign_id)=(...) already exists in observer_access_tokens_one_active_per_call_sign_idx."
      })
    ).toBe("หน่วยรถนี้มีลิงก์ติดตามที่ยังใช้งานอยู่ กดออกลิงก์ใหม่เพื่อแทนที่ลิงก์เดิม");
  });

  it("still names the field for an ordinary duplicate an operator can retype", () => {
    expect(getDatabaseErrorMessage(duplicate("projects_project_code_key"))).toBe("รหัสโครงการ ถูกใช้แล้ว กรุณาเปลี่ยนเป็นค่าอื่น");
  });

  it("falls back to the generic label for a duplicate it does not recognise", () => {
    expect(getDatabaseErrorMessage(duplicate("some_future_table_key"))).toBe("ข้อมูลนี้ ถูกใช้แล้ว กรุณาเปลี่ยนเป็นค่าอื่น");
  });

  it("keeps the other database failures it already explained", () => {
    expect(getDatabaseErrorMessage({ code: "23503" })).toContain("ไม่สัมพันธ์กัน");
    expect(getDatabaseErrorMessage({ code: "23502" })).toContain("ให้ครบถ้วน");
    expect(getDatabaseErrorMessage({ message: "fetch failed" })).toContain("เชื่อมต่อฐานข้อมูลไม่ได้");
    expect(getDatabaseErrorMessage(null)).toBe("บันทึกข้อมูลไม่สำเร็จ");
  });
});
