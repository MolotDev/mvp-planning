import { BATTLE_GROUP_1_ID, BATTLE_GROUP_2_ID, createMissionSeed } from "@/data/missionSeed";
import { createBattleGroupSeed } from "@/data/battleGroupSeed";
import { PLANNED_LAUNCH_STATUS_ID } from "@/data/launchCatalog";
import { SEED_AIMING_POINTS, SEED_TARGETS } from "@/data/targetSeed";
import { resolveDefaultAimingMgrs } from "@/lib/launchAiming";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";

export const LAUNCH_BG1_IDS = [
  "f1111111-1111-4111-8111-111111111101",
  "f1111111-1111-4111-8111-111111111102",
  "f1111111-1111-4111-8111-111111111103",
  "f1111111-1111-4111-8111-111111111104",
] as const;

export const LAUNCH_BG2_IDS = [
  "f2222222-2222-4222-8222-222222222201",
  "f2222222-2222-4222-8222-222222222202",
] as const;

const SEEDED_IDS: Record<string, readonly string[]> = {
  [BATTLE_GROUP_1_ID]: LAUNCH_BG1_IDS,
  [BATTLE_GROUP_2_ID]: LAUNCH_BG2_IDS,
};

export function createLaunchRecord(
  group: Pick<BattleGroup, "id" | "task_id" | "asset_id">,
  createdAt: string,
  id: string,
  aimingMgrs = "",
  allocationLineId: string | null = null,
  launchOrder: number = 1,
): Launch {
  return {
    launch_order: launchOrder,
    id,
    task_id: group.task_id,
    battle_group_id: group.id,
    allocation_line_id: allocationLineId,
    asset_id: group.asset_id,
    asset_serial_number: "",
    tracker_model_id: "",
    tracker_model_serial_number: "",
    aiming_point_mgrs: aimingMgrs,
    trajectory_name: null,
    ammo_model_id: "",
    ammo_quantity: 0,
    created_at: createdAt,
    updated_at: createdAt,
    archived_at: null,
    reported_at: null,
    reported_at_time: null,
    processed_at: null,
    launch_status_id: PLANNED_LAUNCH_STATUS_ID,
    cause_launch_problem_id: "",
    comments: "",
    actual_launch_time: null,
    execution_status: "pending",
    bda_result: null,
  };
}

export function createLaunchSeed(now = new Date(), groups = createBattleGroupSeed(now)): Launch[] {
  const { tasks } = createMissionSeed(now);
  const base = now.getTime();
  let offset = 0;
  const launches: Launch[] = [];
  groups.forEach((group) => {
    const task = tasks.find((item) => item.id === group.task_id);
    const line = task?.allocations.find((item) => item.asset_id === group.asset_id) ?? task?.allocations[0];
    const aimingMgrs = resolveDefaultAimingMgrs(task, SEED_AIMING_POINTS, SEED_TARGETS) ?? "";
    const ids = SEEDED_IDS[group.id];
    for (let index = 0; index < group.uav_quantity; index += 1) {
      offset += 1;
      const createdAt = new Date(base + offset * 1000).toISOString();
      const id = ids?.[index] ?? crypto.randomUUID();
      launches.push(createLaunchRecord(group, createdAt, id, aimingMgrs, line?.id ?? null));
    }
  });
  return launches;
}
