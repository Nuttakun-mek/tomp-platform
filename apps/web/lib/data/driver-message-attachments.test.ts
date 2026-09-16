import { describe, expect, it } from "vitest";
import { attachmentFromMetadata } from "./driver-message-attachments";

describe("attachmentFromMetadata", () => {
  it("reads a driver message photo attachment", () => {
    expect(
      attachmentFromMetadata({
        attachment: {
          type: "photo",
          storagePath: "project/assignment/message-1.jpg",
          capturedAt: "2026-09-16T06:00:00.000Z",
          latitude: 13.7563,
          longitude: 100.5018,
          accuracy: 12,
          hasLocation: true,
          stampApplied: true
        }
      })
    ).toMatchObject({
      type: "photo",
      storagePath: "project/assignment/message-1.jpg",
      latitude: 13.7563,
      longitude: 100.5018,
      hasLocation: true
    });
  });

  it("ignores malformed attachment metadata", () => {
    expect(attachmentFromMetadata({ attachment: { type: "photo" } })).toBeNull();
    expect(attachmentFromMetadata({ attachment: { type: "file", storagePath: "x" } })).toBeNull();
  });
});
