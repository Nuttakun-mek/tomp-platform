import { describe, expect, it } from "vitest";
import { spreadOverlappingMapPoints } from "./marker-overlap";

describe("spreadOverlappingMapPoints", () => {
  it("does not move a marker when it is alone", () => {
    const [point] = spreadOverlappingMapPoints([{ id: "A", latitude: 13.75, longitude: 100.5 }]);

    expect(point.displayLatitude).toBe(13.75);
    expect(point.displayLongitude).toBe(100.5);
    expect(point.isOffset).toBe(false);
  });

  it("visually separates markers at the same coordinate", () => {
    const points = spreadOverlappingMapPoints([
      { id: "B", latitude: 13.75, longitude: 100.5 },
      { id: "A", latitude: 13.75, longitude: 100.5 }
    ]);

    expect(points).toHaveLength(2);
    expect(points.every((point) => point.isOffset)).toBe(true);
    expect(new Set(points.map((point) => `${point.displayLatitude},${point.displayLongitude}`)).size).toBe(2);
    expect(points[0].latitude).toBe(13.75);
    expect(points[0].longitude).toBe(100.5);
  });

  it("keeps different coordinates untouched", () => {
    const points = spreadOverlappingMapPoints([
      { id: "A", latitude: 13.75, longitude: 100.5 },
      { id: "B", latitude: 13.7502, longitude: 100.5 }
    ]);

    expect(points.every((point) => point.isOffset)).toBe(false);
  });
});
