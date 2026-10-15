import { resolveDefaultAimingMgrs } from "@/lib/launchAiming";
import { isPlannedUnprocessed, withProcessedAt } from "@/lib/launches";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Task } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";

interface AssetRef {
  id: string;
  ammo_ids: string[];
}

export interface AllocationPair {
  before: Task;
  after: Task;
}

interface CascadeInput {
  pairs: AllocationPair[];
  archivedTaskIds: string[];
  now: string;
  launches: Launch[];
  groups: BattleGroup[];
  targets: Target[];
  aimingPoints: AimingPoint[];
  assets: AssetRef[];
}

function defaultAmmo(assets: AssetRef[], assetId: string): string {
  return assets.find((asset) => asset.id === assetId)?.ammo_ids[0] ?? "";
}

function byCreatedAt(left: { created_at: string; id: string }, right: { created_at: string; id: string }): number {
  return left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id);
}

export function cascadeMissionAllocation(input: CascadeInput): { launches: Launch[]; groups: BattleGroup[] } {
  let launches = input.launches.map((launch) => ({ ...launch }));
  let groups = input.groups.map((group) => ({
    ...group,
    support_crew_ids: [...group.support_crew_ids],
  }));
  const archived = new Set(input.archivedTaskIds);

  const trimGroupLaunches = (groupId: string, keep: number) => {
    const active = launches
      .filter((launch) => launch.battle_group_id === groupId && launch.archived_at === null)
      .sort(byCreatedAt);
    if (active.length <= keep) {
      return;
    }
    const victims = [...active]
      .reverse()
      .filter((launch) => isPlannedUnprocessed(launch))
      .slice(0, active.length - keep);
    const drop = new Set(victims.map((launch) => launch.id));
    launches = launches.map((launch) =>
      drop.has(launch.id) ? { ...launch, archived_at: input.now, updated_at: input.now } : launch,
    );
  };

  const fitGroupsToQuantity = (taskId: string, quantity: number) => {
    const active = groups
      .filter((group) => group.task_id === taskId && group.archived_at === null)
      .sort(byCreatedAt);
    let sum = active.reduce((total, group) => total + group.uav_quantity, 0);
    if (sum <= quantity) {
      return;
    }
    const updates = new Map<string, { quantity: number; archived: boolean }>();
    for (let index = active.length - 1; index >= 0 && sum > quantity; index -= 1) {
      const group = active[index];
      const excess = sum - quantity;
      if (group.uav_quantity <= excess) {
        updates.set(group.id, { quantity: 0, archived: true });
        sum -= group.uav_quantity;
      } else {
        updates.set(group.id, { quantity: group.uav_quantity - excess, archived: false });
        sum = quantity;
      }
    }
    groups = groups.map((group) => {
      const update = updates.get(group.id);
      if (!update) {
        return group;
      }
      return update.archived
        ? { ...group, uav_quantity: 0, archived_at: input.now, updated_at: input.now }
        : { ...group, uav_quantity: update.quantity, updated_at: input.now };
    });
    updates.forEach((update, groupId) => {
      trimGroupLaunches(groupId, update.archived ? 0 : update.quantity);
    });
  };

  if (archived.size > 0) {
    launches = launches.map((launch) =>
      archived.has(launch.task_id) && launch.archived_at === null && launch.reported_at === null
        ? { ...launch, archived_at: input.now, updated_at: input.now }
        : launch,
    );
  }

  input.pairs.forEach((pair) => {
    const assetChanged = pair.before.asset_id !== pair.after.asset_id;
    const targetChanged = (pair.before.target_ids[0] ?? "") !== (pair.after.target_ids[0] ?? "");
    const pointsChanged = pair.before.aiming_point_id !== pair.after.aiming_point_id;
    const mgrs = resolveDefaultAimingMgrs(pair.after, input.aimingPoints, input.targets) ?? "";

    if (assetChanged) {
      const ammo = defaultAmmo(input.assets, pair.after.asset_id);
      launches = launches.map((launch) => {
        if (
          launch.task_id !== pair.after.id ||
          launch.archived_at !== null ||
          launch.reported_at !== null
        ) {
          return launch;
        }
        return withProcessedAt(
          {
            ...launch,
            asset_id: pair.after.asset_id,
            ammo_model_id: ammo,
            asset_serial_number: "",
            tracker_model_id: null,
            tracker_model_serial_number: null,
            updated_at: input.now,
          },
          input.now,
        );
      });
      groups = groups.map((group) =>
        group.task_id === pair.after.id && group.archived_at === null
          ? { ...group, asset_id: pair.after.asset_id, updated_at: input.now }
          : group,
      );
    }

    if (pair.after.quantity < pair.before.quantity) {
      fitGroupsToQuantity(pair.after.id, pair.after.quantity);
    }

    if ((targetChanged || pointsChanged) && mgrs) {
      launches = launches.map((launch) =>
        launch.task_id === pair.after.id && launch.archived_at === null && launch.reported_at === null
          ? { ...launch, aiming_point_mgrs: mgrs, updated_at: input.now }
          : launch,
      );
    }
  });

  return { launches, groups };
}
