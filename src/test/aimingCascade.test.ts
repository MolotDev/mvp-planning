import { beforeEach, describe, expect, it } from "vitest";
import { AP_2_ID, TARGET_1_ID } from "@/data/targetSeed";
import { draftsFromMission, toTaskDrafts } from "@/lib/missionForm";
import { ALLOCATION_1_ID, MISSION_1_ID, TASK_1_ID } from "@/data/missionSeed";
import { LAUNCH_BG1_IDS } from "@/data/launchSeed";
import { resetBattleGroupStore, useBattleGroupStore } from "@/store/useBattleGroupStore";
import { resetLaunchStore, useLaunchStore } from "@/store/useLaunchStore";
import { resetMissionStore, useMissionStore } from "@/store/useMissionStore";
import { resetTaskStore, useTaskStore } from "@/store/useTaskStore";
import { resetTargetStore } from "@/store/useTargetStore";
import { reconcileLaunchesWithBattleGroups } from "@/store/storeBridge";

function fillLaunch() {
  const saved = useLaunchStore.getState().updateLaunch(LAUNCH_BG1_IDS[0], {
    asset_serial_number: "VR-101",
    tracker_model_serial_number: "TR-1",
    trajectory_name: "Т-1",
  });
  expect(saved?.asset_serial_number).toBe("VR-101");
}

function missionInput() {
  const mission = useMissionStore.getState().missions.find((item) => item.id === MISSION_1_ID)!;
  return {
    name: mission.name,
    scheduled_at: mission.scheduled_at,
    description: mission.description,
  };
}

beforeEach(() => {
  resetTargetStore();
  resetBattleGroupStore();
  resetLaunchStore();
  resetTaskStore();
  resetMissionStore();
});

describe("aiming point mission edit keeps launch equipment", () => {
  it("keeps serials when the same allocation id changes aiming point", () => {
    fillLaunch();
    const task = useTaskStore.getState().tasks.find((item) => item.id === TASK_1_ID)!;
    const line = task.allocations[0];
    useMissionStore.getState().updateMission(MISSION_1_ID, missionInput(), [
      {
        id: line.id,
        target_id: line.target_id,
        aiming_point_id: AP_2_ID,
        organization_id: task.organization_id,
        asset_id: line.asset_id,
        quantity: line.quantity,
      },
      ...useTaskStore
        .getState()
        .tasks.filter((item) => item.id !== TASK_1_ID)
        .flatMap((item) =>
          item.allocations
            .filter((allocation) => allocation.mission_id === MISSION_1_ID)
            .map((allocation) => ({
              id: allocation.id,
              target_id: allocation.target_id,
              aiming_point_id: allocation.aiming_point_id,
              organization_id: item.organization_id,
              asset_id: allocation.asset_id,
              quantity: allocation.quantity,
            })),
        ),
    ]);
    const launch = useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0]);
    expect(launch?.archived_at).toBeNull();
    expect(launch?.asset_serial_number).toBe("VR-101");
    expect(launch?.tracker_model_serial_number).toBe("TR-1");
    expect(launch?.trajectory_name).toBe("Т-1");
    expect(launch?.aiming_point_mgrs.replace(/\s/g, "")).toContain("45230");
    reconcileLaunchesWithBattleGroups();
    const after = useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0]);
    expect(after?.asset_serial_number).toBe("VR-101");
    expect(after?.trajectory_name).toBe("Т-1");
  });

  it("keeps serials when the form drops the allocation id and only the aiming point changes", () => {
    fillLaunch();
    const mission = useMissionStore.getState().missions.find((item) => item.id === MISSION_1_ID)!;
    const drafts = draftsFromMission(mission, useTaskStore.getState().tasks).map((block) => ({
      ...block,
      detachments: block.detachments.map((row) =>
        row.task_id === ALLOCATION_1_ID
          ? { ...row, task_id: undefined, aiming_point_id: AP_2_ID }
          : row,
      ),
    }));
    useMissionStore.getState().updateMission(MISSION_1_ID, missionInput(), toTaskDrafts(drafts));
    const active = useLaunchStore
      .getState()
      .launches.filter((item) => item.battle_group_id && item.archived_at === null && item.asset_serial_number === "VR-101");
    expect(active).toHaveLength(1);
    expect(active[0]?.tracker_model_serial_number).toBe("TR-1");
    expect(active[0]?.trajectory_name).toBe("Т-1");
    expect(useTaskStore.getState().tasks.find((item) => item.id === TASK_1_ID)?.allocations[0]?.aiming_point_id).toBe(AP_2_ID);
    expect(useBattleGroupStore.getState().battleGroups.find((item) => item.task_id === TASK_1_ID)?.archived_at).toBeNull();
    const launch = useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0]);
    expect(launch?.asset_serial_number).toBe("VR-101");
    expect(launch?.aiming_point_mgrs.replace(/\s/g, "")).toContain("45230");
    expect(useTaskStore.getState().tasks.find((item) => item.id === TASK_1_ID)?.allocations[0]?.id).toBe(ALLOCATION_1_ID);
  });

  it("archives filled launches when the asset changes even if the allocation id is dropped", () => {
    fillLaunch();
    const mission = useMissionStore.getState().missions.find((item) => item.id === MISSION_1_ID)!;
    const drafts = draftsFromMission(mission, useTaskStore.getState().tasks).map((block) => ({
      ...block,
      detachments: block.detachments.map((row) =>
        row.task_id === ALLOCATION_1_ID ? { ...row, task_id: undefined, asset_id: "uav_2" } : row,
      ),
    }));
    useMissionStore.getState().updateMission(MISSION_1_ID, missionInput(), toTaskDrafts(drafts));
    const launch = useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0]);
    expect(launch?.archived_at).not.toBeNull();
    expect(useBattleGroupStore.getState().battleGroups.find((item) => item.id === launch?.battle_group_id)?.archived_at).not.toBeNull();
  });

  it("keeps serials through the real form path when only the aiming point changes", () => {
    fillLaunch();
    const mission = useMissionStore.getState().missions.find((item) => item.id === MISSION_1_ID)!;
    const drafts = draftsFromMission(mission, useTaskStore.getState().tasks).map((block) =>
      block.target_id === TARGET_1_ID
        ? {
            ...block,
            detachments: block.detachments.map((row) =>
              row.task_id === ALLOCATION_1_ID ? { ...row, aiming_point_id: AP_2_ID } : row,
            ),
          }
        : block,
    );
    useMissionStore.getState().updateMission(MISSION_1_ID, missionInput(), toTaskDrafts(drafts));
    const launch = useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0]);
    expect(launch?.asset_serial_number).toBe("VR-101");
    expect(launch?.trajectory_name).toBe("Т-1");
    expect(launch?.archived_at).toBeNull();
  });
});
