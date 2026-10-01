import { describe, it, expect } from "vitest";
import { getTimeRemaining } from "./countdown";

describe("getTimeRemaining", () => {
  it("computes days/hours/minutes/seconds remaining", () => {
    const now = new Date("2026-11-30T00:00:00Z");
    const result = getTimeRemaining("2026-12-01T00:00:00Z", now);
    expect(result).toEqual({ days: 1, hours: 0, minutes: 0, seconds: 0, isPast: false });
  });

  it("returns isPast true once the target has passed", () => {
    const now = new Date("2026-12-02T00:00:00Z");
    const result = getTimeRemaining("2026-12-01T00:00:00Z", now);
    expect(result.isPast).toBe(true);
  });

  it("handles partial units correctly", () => {
    const now = new Date("2026-11-30T22:30:15Z");
    const result = getTimeRemaining("2026-12-01T00:00:00Z", now);
    expect(result).toEqual({ days: 0, hours: 1, minutes: 29, seconds: 45, isPast: false });
  });
});
