import { describe, expect, it } from "vitest";
import { parseAllocationQuantity, crewTimelineWindow, crewWeekLoads, crewHeatmap, assetShortName } from "@/lib/taskDashboard";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Task } from "@/types/mission";

describe("allocation quantity", () => {
  it("accepts a positive integer inside the remaining cap", () => {
    expect(parseAllocationQuantity("4", 4)).toBe(4);
    expect(parseAllocationQuantity("0", 4)).toBeNull();
    expect(parseAllocationQuantity("", 4)).toBeNull();
    expect(parseAllocationQuantity("5", 4)).toBeNull();
  });
});

describe("crew week", () => {
  it("places a past launch on its scheduled day and counts a successful status", () => {
    const task = {
      id: "task-1",
      scheduled_at: "2026-10-16T09:00:00.000Z",
    } as Task;
    const group = {
      id: "group-1",
      lead_crew_id: "1.1.1",
      archived_at: null,
    } as BattleGroup;
    const launch = {
      id: "launch-1",
      task_id: "task-1",
      battle_group_id: "group-1",
      archived_at: null,
      launch_status_id: "success",
    } as Launch;
    const now = new Date("2026-10-17T12:00:00.000Z");
    const days = crewTimelineWindow(now, "2026-10-12T00:00:00.000Z");
    expect(days).toHaveLength(7);
    const week = crewWeekLoads("1.1.1", [task], [group], [launch], now, "2026-10-12T00:00:00.000Z");
    expect(week.engagement).toEqual({ hits: 1, total: 1, rate: 100 });
    expect(week.days.some((day) => day.count === 1 && day.kind === "past")).toBe(true);
  });
});

describe("crew heatmap", () => {
  it("centers seven days on today and splits success from problems", () => {
    expect(assetShortName("Ворон")).toBe("Вор");
    const now = new Date(2026, 9, 18, 12, 0, 0);
    const task = { id: "task-1", scheduled_at: new Date(2026, 9, 18, 8, 0, 0).toISOString() } as Task;
    const group = { id: "group-1", lead_crew_id: "1.1.1", archived_at: null } as BattleGroup;
    const launches = [
      { id: "a", task_id: "task-1", battle_group_id: "group-1", asset_id: "uav_1", archived_at: null, launch_status_id: "success" },
      { id: "b", task_id: "task-1", battle_group_id: "group-1", asset_id: "uav_1", archived_at: null, launch_status_id: "problem" },
    ] as Launch[];
    const [row] = crewHeatmap(["1.1.1"], [task], [group], launches, now);
    expect(row.days).toHaveLength(7);
    expect(row.days[3]?.today).toBe(true);
    expect(row.days[3]?.assets[0]).toEqual({ assetId: "uav_1", total: 2, successful: 1, problematic: 1 });
    expect(row.successRate).toBe(50);
    expect(row.days[0]?.assets).toEqual([]);
  });
});
