// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DateTimeField } from "./datetime-field";

// The time picker sets a clock time: an hour and a minute picked directly, or
// typed. It used to be −/+ steppers (and a mouse-wheel counter), which read as
// a countdown timer rather than "start at / end at".
function openPicker(value: string) {
  const onChange = vi.fn();
  render(<DateTimeField label="เวลาเริ่ม" name="start" value={value} onChange={onChange} timeOnly required />);
  fireEvent.click(screen.getByRole("button", { name: /เวลาเริ่ม|น\.|เลือกเวลา/ }));
  return onChange;
}

describe("DateTimeField time picker", () => {
  it("has no −/+ stepper buttons", () => {
    openPicker("09:00");
    expect(screen.queryByRole("button", { name: /^ลด|^เพิ่ม/ })).toBeNull();
  });

  it("sets the hour with one tap, keeping the minute", () => {
    const onChange = openPicker("09:30");
    fireEvent.click(screen.getByRole("button", { name: "14 นาฬิกา" }));
    expect(onChange).toHaveBeenLastCalledWith("14:30");
  });

  it("sets the minute with one tap, keeping the hour", () => {
    const onChange = openPicker("09:30");
    fireEvent.click(screen.getByRole("button", { name: "45 นาที" }));
    expect(onChange).toHaveBeenLastCalledWith("09:45");
  });

  it("accepts a typed time for minutes off the 5-minute grid", () => {
    const onChange = openPicker("09:30");
    const input = screen.getByLabelText("พิมพ์เวลา");
    fireEvent.change(input, { target: { value: "7:07" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith("07:07");
  });

  it("ignores a typed value that is not a time", () => {
    const onChange = openPicker("09:30");
    const input = screen.getByLabelText("พิมพ์เวลา");
    fireEvent.change(input, { target: { value: "25:99x" } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe("09:30");
  });
});
