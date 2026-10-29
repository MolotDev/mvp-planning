import { describe, expect, it } from "vitest";
import { resolveLaunchAimingPoint } from "@/lib/launchAiming";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Task } from "@/types/mission";
import type { AimingPoint } from "@/types/target";

const point = (id: string, mgrs: string): AimingPoint => ({
  id,
  target_id: "target-1",
  label: id,
  displayed_id: id,
  name: id,
  mgrs,
  agl_msl: 0,
  feat_hgt_msl: 0,
  created_at: "",
  updated_at: "",
  archived_at: null,
});

const task = {
  allocations: [
    { id: "line-1", mission_id: "m", target_id: "target-1", aiming_point_id: "ap-1", asset_id: "uav_1", quantity: 2 },
    { id: "line-2", mission_id: "m", target_id: "target-2", aiming_point_id: "ap-2", asset_id: "uav_2", quantity: 1 },
  ],
} as Task;

const group = {
  allocation_line_id: "line-2",
  asset_id: "uav_2",
} as BattleGroup;

describe("resolveLaunchAimingPoint", () => {
  const points = [point("ap-1", "36U EV 11111 22222"), point("ap-2", "36UEV3333344444")];

  it("uses the battle group allocation even when the stored MGRS spacing differs", () => {
    const launch = {
      allocation_line_id: null,
      asset_id: "uav_2",
      aiming_point_mgrs: "36U EV 33333 44444",
    } as Launch;
    expect(resolveLaunchAimingPoint(task, launch, group, points)?.id).toBe("ap-2");
  });

  it("does not list a sibling aiming point from another allocation", () => {
    const launch = {
      allocation_line_id: "line-1",
      asset_id: "uav_1",
      aiming_point_mgrs: "36UEV3333344444",
    } as Launch;
    expect(resolveLaunchAimingPoint(task, launch, undefined, points)?.id).toBe("ap-1");
  });

  it("matches a task aiming point by coordinates when the allocation has no point", () => {
    const openTask = {
      allocations: [
        { id: "line-1", mission_id: "m", target_id: "target-1", aiming_point_id: null, asset_id: "uav_1", quantity: 1 },
        { id: "line-3", mission_id: "m", target_id: "target-1", aiming_point_id: "ap-1", asset_id: "uav_3", quantity: 1 },
      ],
    } as Task;
    const launch = {
      allocation_line_id: "line-1",
      asset_id: "uav_1",
      aiming_point_mgrs: "36UEV1111122222",
    } as Launch;
    expect(resolveLaunchAimingPoint(openTask, launch, undefined, points)?.id).toBe("ap-1");
  });

  it("keeps free-form MP## allocation codes when no catalog aiming point exists", () => {
    const codedTask = {
      allocations: [
        {
          id: "line-mp05",
          mission_id: "m",
          target_id: "target-1",
          aiming_point_id: "MP05",
          asset_id: "uav_1",
          quantity: 1,
        },
      ],
    } as Task;
    const launch = {
      allocation_line_id: "line-mp05",
      asset_id: "uav_1",
      aiming_point_mgrs: "36U EV 45210 88320",
    } as Launch;
    const resolved = resolveLaunchAimingPoint(codedTask, launch, undefined, []);
    expect(resolved?.displayed_id).toBe("MP05");
    expect(resolved?.name).toBe("");
  });
});
