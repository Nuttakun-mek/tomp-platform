import { describe, expect, it } from "vitest";
import { buildTrack, splitTrack, TRACK_WINDOW_MS } from "./location-track";

const NOW = Date.parse("2026-09-27T10:00:00Z");
const at = (secondsAgo: number) => new Date(NOW - secondsAgo * 1000).toISOString();
// ~33 m per step north
const ping = (secondsAgo: number, step: number, accuracy: number | null = 8) => ({
  latitude: 13.75 + step * 0.0003,
  longitude: 100.5,
  accuracy,
  recordedAt: at(secondsAgo)
});

describe("buildTrack", () => {
  it("orders oldest first and drops pings outside the window, coarse fixes and 0,0", () => {
    const track = buildTrack(
      [
        ping(10, 3),
        ping(TRACK_WINDOW_MS / 1000 + 5, 0),
        ping(30, 1),
        ping(20, 2, 120),
        { latitude: 0, longitude: 0, accuracy: 5, recordedAt: at(15) }
      ],
      NOW
    );
    expect(track.map((point) => point[2])).toEqual([Date.parse(at(30)), Date.parse(at(10))]);
  });

  it("thins points closer than 10 m, but keeps the one that ends a signal gap", () => {
    const parked = { latitude: 13.75, longitude: 100.5, accuracy: 5 };
    const track = buildTrack(
      [
        { ...parked, recordedAt: at(400) },
        { ...parked, recordedAt: at(398) },
        { ...parked, recordedAt: at(100) }
      ],
      NOW
    );
    expect(track).toHaveLength(2);
    expect(track[1][2]).toBe(Date.parse(at(100)));
  });
});

describe("splitTrack", () => {
  it("draws continuous reporting as one line", () => {
    const track = buildTrack([ping(9, 0), ping(6, 1), ping(3, 2)], NOW);
    const { driven, gaps } = splitTrack(track);
    expect(driven).toHaveLength(1);
    expect(driven[0]).toHaveLength(3);
    expect(gaps).toHaveLength(0);
  });

  it("does not draw a solid line across a signal gap", () => {
    // Lost signal for 5 minutes and came back 1 km away.
    const track = buildTrack([ping(420, 0), ping(417, 1), ping(117, 30), ping(114, 31)], NOW);
    const { driven, gaps } = splitTrack(track);
    expect(driven).toHaveLength(2);
    expect(gaps).toEqual([[[driven[0][1][0], 100.5], [driven[1][0][0], 100.5]]]);
  });

  it("keeps a parked car's two-minute heartbeat as one continuous line", () => {
    const track = buildTrack([ping(360, 0), ping(240, 1), ping(120, 2)], NOW);
    expect(splitTrack(track).gaps).toHaveLength(0);
  });
});
