import { describe, expect, it } from "vitest";
import { assignSequentialMissionLabels, nextMissionNumber } from "@/lib/missionLabel";
import type { Mission } from "@/types/mission";

function mission(label: string, createdAt: string): Mission {
  return {
    id: label,
    label,
    name: null,
    scheduled_at: createdAt,
    description: "",
    task_ids: [],
    created_at: createdAt,
    updated_at: createdAt,
    reported_at: null,
    confirmed_at: null,
    archived_at: null,
  };
}

describe("mission labels", () => {
  it("gives a detachment daily mission the next sequential number", () => {
    const missions = [
      mission("MN-1", "2026-10-18T00:00:00.000Z"),
      mission("MN-2", "2026-10-19T00:00:00.000Z"),
      mission("MN-3", "2026-10-20T00:00:00.000Z"),
    ];
    expect(nextMissionNumber(missions, 3)).toBe(4);
  });

  it("replaces a date label with the next free number and keeps MN-1..MN-3", () => {
    const fixed = assignSequentialMissionLabels(
      [
        mission("MN-3", "2026-10-20T00:00:00.000Z"),
        mission("MN-2", "2026-10-19T00:00:00.000Z"),
        mission("MN-2026-10-22", "2026-10-21T12:00:00.000Z"),
        mission("MN-1", "2026-10-18T00:00:00.000Z"),
        mission("MN-2026-10-23", "2026-10-21T18:00:00.000Z"),
      ],
      4,
    );
    expect(fixed.missions.map((item) => item.label)).toEqual(["MN-3", "MN-2", "MN-4", "MN-1", "MN-5"]);
    expect(fixed.missionSeq).toBe(5);
  });
});
