// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PhotoViewer } from "./photo-viewer";

afterEach(cleanup);

describe("PhotoViewer", () => {
  it("shows the photo full screen and closes on the button, the backdrop or Escape", () => {
    const onClose = vi.fn();
    render(<PhotoViewer src="https://example.test/p.jpg" alt="รูปจากคนขับ" onClose={onClose} />);
    expect(screen.getByRole("img", { name: "รูปจากคนขับ" }).getAttribute("src")).toBe("https://example.test/p.jpg");

    fireEvent.click(screen.getByRole("img", { name: "รูปจากคนขับ" }));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "ปิดรูป" }));
    fireEvent.click(screen.getByRole("dialog"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
