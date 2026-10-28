import { describe, expect, it } from "vitest";
import { cascadeMissionAllocation, filledBoardCount } from "@/lib/missionCascade";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Task, TaskAllocation } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";

const NOW = "2026-10-17T09:00:00.000Z";

function allocation(patch: Partial<TaskAllocation> & Pick<TaskAllocation, "id" | "asset_id" | "quantity">): TaskAllocation {
  return {
    mission_id: "mission-1",
    target_id: "target-1",
    aiming_point_id: "ap-1",
    ...patch,
  };
}

function task(id: string, organizationId: string, lines: TaskAllocation[]): Task {
  return {
    id,
    label: id,
    organization_id: organizationId,
    mission_id: lines[0]?.mission_id || null,
    source: "center",
    scheduled_at: NOW,
    allocations: lines,
    battle_groups_ids: [],
    fact_submitted_at: null,
    fact_notes: null,
    created_at: NOW,
    updated_at: NOW,
    reported_at: null,
    confirmed_at: null,
    archived_at: null,
  };
}

function launch(patch: Partial<Launch> & Pick<Launch, "id">): Launch {
  return {
    task_id: "task-1",
    battle_group_id: "group-1",
    allocation_line_id: "line-1",
    asset_id: "uav_1",
    asset_serial_number: "",
    tracker_model_id: null,
    tracker_model_serial_number: null,
    aiming_point_mgrs: "36U EV 11111 11111",
    trajectory_name: "Т-1",
    ammo_model_id: "",
    ammo_quantity: 0,
    created_at: NOW,
    updated_at: NOW,
    archived_at: null,
    confirmed_at: null,
    reported_at: null,
    reported_at_time: null,
    processed_at: null,
    launch_status_id: "planned",
    cause_launch_problem_id: "",
    comments: "",
    actual_launch_time: null,
    execution_status: "pending",
    bda_result: null,
    ...patch,
    launch_order: patch.launch_order ?? 1,
  };
}

function group(patch: Partial<BattleGroup> = {}): BattleGroup {
  return {
    id: "group-1",
    task_id: "task-1",
    lead_crew_id: "1.1.1",
    support_crew_ids: [],
    asset_id: "uav_1",
    allocation_line_id: "line-1",
    uav_quantity: 1,
    created_at: NOW,
    updated_at: NOW,
    archived_at: null,
    ...patch,
  };
}

const target: Target = {
  id: "target-1",
  label: "T",
  displayed_id: "",
  name: "Склад",
  address: "",
  type: "Склад БК",
  distance_from_hot_line: 0,
  mgrs: "36UEV0000000000",
  created_at: NOW,
  updated_at: NOW,
  archived_at: null,
  aiming_point_ids: ["ap-1", "ap-2"],
  image_url: null,
};

function aimingPoint(id: string, mgrs: string): AimingPoint {
  return {
    id,
    target_id: "target-1",
    label: id,
    displayed_id: "",
    name: id,
    mgrs,
    agl_msl: 1,
    feat_hgt_msl: 2,
    created_at: NOW,
    updated_at: NOW,
    archived_at: null,
  };
}

describe("cascadeMissionAllocation", () => {
  it("updates aiming coordinates and keeps board data when only the aiming point changes", () => {
    const beforeLine = allocation({ id: "line-1", asset_id: "uav_1", quantity: 1, aiming_point_id: "ap-1" });
    const afterLine = allocation({ id: "line-1", asset_id: "uav_1", quantity: 1, aiming_point_id: "ap-2" });
    const result = cascadeMissionAllocation({
      beforeTasks: [task("task-1", "detachment_1", [beforeLine])],
      afterTasks: [task("task-1", "detachment_1", [afterLine])],
      archivedTaskIds: [],
      now: NOW,
      launches: [launch({ id: "launch-1", asset_serial_number: "VR-101", tracker_model_serial_number: "TR-1", trajectory_name: "Т-1" })],
      groups: [group()],
      targets: [target],
      aimingPoints: [aimingPoint("ap-1", "36UEV1111111111"), aimingPoint("ap-2", "36UEV2222222222")],
    });
    const next = result.launches[0];
    expect(next.archived_at).toBeNull();
    expect(next.aiming_point_mgrs).toBe("36UEV2222222222");
    expect(next.asset_serial_number).toBe("VR-101");
    expect(next.tracker_model_serial_number).toBe("TR-1");
    expect(next.trajectory_name).toBe("Т-1");
    expect(next.battle_group_id).toBe("group-1");
    expect(result.groups[0].archived_at).toBeNull();
  });

  it("keeps board data when the allocation id is replaced and only the aiming point changes", () => {
    const beforeLine = allocation({ id: "line-1", asset_id: "uav_1", quantity: 1, aiming_point_id: "ap-1" });
    const afterLine = allocation({ id: "line-2", asset_id: "uav_1", quantity: 1, aiming_point_id: "ap-2" });
    const result = cascadeMissionAllocation({
      beforeTasks: [task("task-1", "detachment_1", [beforeLine])],
      afterTasks: [task("task-1", "detachment_1", [afterLine])],
      archivedTaskIds: [],
      now: NOW,
      launches: [
        launch({
          id: "launch-1",
          allocation_line_id: null,
          asset_serial_number: "VR-101",
          tracker_model_serial_number: "TR-1",
          trajectory_name: "Т-1",
        }),
      ],
      groups: [group()],
      targets: [target],
      aimingPoints: [aimingPoint("ap-1", "36UEV1111111111"), aimingPoint("ap-2", "36UEV2222222222")],
    });
    const next = result.launches[0];
    expect(next.archived_at).toBeNull();
    expect(next.allocation_line_id).toBe("line-2");
    expect(next.aiming_point_mgrs).toBe("36UEV2222222222");
    expect(next.asset_serial_number).toBe("VR-101");
    expect(next.tracker_model_serial_number).toBe("TR-1");
    expect(next.trajectory_name).toBe("Т-1");
    expect(result.groups[0].archived_at).toBeNull();
    expect(result.groups[0].allocation_line_id).toBe("line-2");
  });

  it("keeps board data for legacy launches that are not linked to an allocation line", () => {
    const beforeLine = allocation({ id: "line-1", asset_id: "uav_1", quantity: 1, aiming_point_id: "ap-1" });
    const afterLine = allocation({ id: "line-1", asset_id: "uav_1", quantity: 1, aiming_point_id: "ap-2" });
    const result = cascadeMissionAllocation({
      beforeTasks: [task("task-1", "detachment_1", [beforeLine])],
      afterTasks: [task("task-1", "detachment_1", [afterLine])],
      archivedTaskIds: [],
      now: NOW,
      launches: [
        launch({
          id: "launch-1",
          allocation_line_id: null,
          asset_serial_number: "SN-42",
          tracker_model_serial_number: null,
          trajectory_name: "Т-7",
        }),
      ],
      groups: [group({ allocation_line_id: null })],
      targets: [target],
      aimingPoints: [aimingPoint("ap-1", "36UEV1111111111"), aimingPoint("ap-2", "36UEV2222222222")],
    });
    const next = result.launches[0];
    expect(next.archived_at).toBeNull();
    expect(next.asset_serial_number).toBe("SN-42");
    expect(next.trajectory_name).toBe("Т-7");
    expect(next.aiming_point_mgrs).toBe("36UEV2222222222");
    expect(next.allocation_line_id).toBe("line-1");
    expect(result.groups[0].archived_at).toBeNull();
    expect(result.groups[0].allocation_line_id).toBe("line-1");
    expect(result.groups[0].uav_quantity).toBe(1);
  });

  it("archives launches and the crew group when the asset changes", () => {
    const beforeLine = allocation({ id: "line-1", asset_id: "uav_1", quantity: 1 });
    const afterLine = allocation({ id: "line-1", asset_id: "uav_2", quantity: 1 });
    const result = cascadeMissionAllocation({
      beforeTasks: [task("task-1", "detachment_1", [beforeLine])],
      afterTasks: [task("task-1", "detachment_1", [afterLine])],
      archivedTaskIds: [],
      now: NOW,
      launches: [launch({ id: "launch-1", asset_serial_number: "VR-101", tracker_model_serial_number: "TR-1" })],
      groups: [group()],
      targets: [target],
      aimingPoints: [aimingPoint("ap-1", "36UEV1111111111")],
    });
    expect(result.launches[0].archived_at).toBe(NOW);
    expect(result.groups[0].archived_at).toBe(NOW);
  });

  it("archives launches when the line moves to another detachment", () => {
    const line = allocation({ id: "line-1", asset_id: "uav_1", quantity: 1 });
    const result = cascadeMissionAllocation({
      beforeTasks: [task("task-1", "detachment_1", [line])],
      afterTasks: [task("task-1", "detachment_1", []), task("task-2", "detachment_2", [line])],
      archivedTaskIds: [],
      now: NOW,
      launches: [launch({ id: "launch-1", asset_serial_number: "VR-101" })],
      groups: [group()],
      targets: [target],
      aimingPoints: [aimingPoint("ap-1", "36UEV1111111111")],
    });
    expect(result.launches[0].archived_at).toBe(NOW);
    expect(result.groups[0].archived_at).toBe(NOW);
  });

  it("keeps filled launches and reports the excess when quantity drops below them", () => {
    const launches = [0, 1, 2, 3, 4].map((index) =>
      launch({
        id: `launch-${index}`,
        battle_group_id: "group-1",
        asset_serial_number: `VR-${index}`,
        tracker_model_serial_number: null,
        created_at: `2026-10-17T09:00:0${index}.000Z`,
      }),
    );
    const result = cascadeMissionAllocation({
      beforeTasks: [task("task-1", "detachment_1", [allocation({ id: "line-1", asset_id: "uav_1", quantity: 5 })])],
      afterTasks: [task("task-1", "detachment_1", [allocation({ id: "line-1", asset_id: "uav_1", quantity: 3 })])],
      archivedTaskIds: [],
      now: NOW,
      launches,
      groups: [group({ uav_quantity: 5 })],
      targets: [target],
      aimingPoints: [aimingPoint("ap-1", "36UEV1111111111")],
    });
    expect(result.launches.every((item) => item.archived_at === null)).toBe(true);
    expect(filledBoardCount(result.launches)).toBe(5);
    expect(result.groups[0].archived_at).toBeNull();
    expect(result.groups[0].uav_quantity).toBe(3);
  });

  it("keeps a launch that only has a route when quantity decreases", () => {
    const result = cascadeMissionAllocation({
      beforeTasks: [task("task-1", "detachment_1", [allocation({ id: "line-1", asset_id: "uav_1", quantity: 2 })])],
      afterTasks: [task("task-1", "detachment_1", [allocation({ id: "line-1", asset_id: "uav_1", quantity: 1 })])],
      archivedTaskIds: [],
      now: NOW,
      launches: [
        launch({ id: "routed", asset_serial_number: "", trajectory_name: "Т-1", created_at: "2026-10-17T09:00:01.000Z" }),
        launch({ id: "empty", asset_serial_number: "", trajectory_name: null, created_at: "2026-10-17T09:00:02.000Z" }),
      ],
      groups: [group({ uav_quantity: 2 })],
      targets: [target],
      aimingPoints: [aimingPoint("ap-1", "36UEV1111111111")],
    });
    const active = result.launches.filter((item) => item.archived_at === null);
    expect(active.map((item) => item.id)).toEqual(["routed"]);
    expect(result.groups[0].uav_quantity).toBe(1);
  });

  it("archives launches of a removed target instead of moving them to another target", () => {
    const removed = allocation({ id: "line-1", asset_id: "uav_1", quantity: 1, target_id: "target-1" });
    const kept = allocation({ id: "line-2", asset_id: "uav_1", quantity: 1, target_id: "target-2" });
    const result = cascadeMissionAllocation({
      beforeTasks: [task("task-1", "detachment_1", [removed, kept])],
      afterTasks: [task("task-1", "detachment_1", [kept])],
      archivedTaskIds: [],
      now: NOW,
      launches: [launch({ id: "launch-1", asset_serial_number: "VR-101", trajectory_name: "Т-1" })],
      groups: [group()],
      targets: [target],
      aimingPoints: [aimingPoint("ap-1", "36UEV1111111111")],
    });
    expect(result.launches[0].archived_at).toBe(NOW);
    expect(result.groups[0].archived_at).toBe(NOW);
  });

  it("archives only empty launches when quantity decreases and some boards are unfilled", () => {
    const launches = [0, 1, 2, 3, 4].map((index) =>
      launch({
        id: `launch-${index}`,
        asset_serial_number: index < 2 ? `VR-${index}` : "",
        tracker_model_serial_number: null,
        trajectory_name: index < 2 ? "Т-1" : null,
        created_at: `2026-10-17T09:00:0${index}.000Z`,
      }),
    );
    const result = cascadeMissionAllocation({
      beforeTasks: [task("task-1", "detachment_1", [allocation({ id: "line-1", asset_id: "uav_1", quantity: 5 })])],
      afterTasks: [task("task-1", "detachment_1", [allocation({ id: "line-1", asset_id: "uav_1", quantity: 3 })])],
      archivedTaskIds: [],
      now: NOW,
      launches,
      groups: [group({ uav_quantity: 5 })],
      targets: [target],
      aimingPoints: [aimingPoint("ap-1", "36UEV1111111111")],
    });
    const active = result.launches.filter((item) => item.archived_at === null);
    expect(active.map((item) => item.id).sort()).toEqual(["launch-0", "launch-1", "launch-2"]);
    expect(result.groups[0].uav_quantity).toBe(3);
  });
});
