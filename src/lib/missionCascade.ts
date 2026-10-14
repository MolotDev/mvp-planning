import { createLaunchRecord } from "@/data/launchSeed";
import { resolveDefaultAimingMgrs } from "@/lib/launchAiming";
import { isPlannedUnprocessed, withProcessedAt } from "@/lib/launches";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Task, UavAsset } from "@/types/mission";
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

function sameIdList(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((id, index) => id === sortedRight[index]);
}

function pairAssets(before: UavAsset[], after: UavAsset[]): {
  updates: { from: UavAsset; to: UavAsset }[];
  removed: UavAsset[];
  added: UavAsset[];
} {
  const used = new Set<number>();
  const updates: { from: UavAsset; to: UavAsset }[] = [];
  const removed: UavAsset[] = [];
  before.forEach((asset) => {
    const index = after.findIndex(
      (item, itemIndex) => !used.has(itemIndex) && item.asset_id === asset.asset_id,
    );
    if (index === -1) {
      removed.push(asset);
      return;
    }
    used.add(index);
    updates.push({ from: asset, to: after[index] });
  });
  const leftoverAfter = after.filter((_, index) => !used.has(index));
  const swaps = Math.min(removed.length, leftoverAfter.length);
  for (let index = 0; index < swaps; index += 1) {
    updates.push({ from: removed[index], to: leftoverAfter[index] });
  }
  return {
    updates,
    removed: removed.slice(swaps),
    added: leftoverAfter.slice(swaps),
  };
}

function defaultAmmo(assets: AssetRef[], assetId: string): string {
  return assets.find((asset) => asset.id === assetId)?.ammo_ids[0] ?? "";
}

function activeLaunches(launches: Launch[], taskId: string, assetId: string): Launch[] {
  return launches
    .filter(
      (launch) => launch.task_id === taskId && launch.asset_id === assetId && launch.archived_at === null,
    )
    .sort((left, right) => left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id));
}

export function cascadeMissionAllocation(input: CascadeInput): { launches: Launch[]; groups: BattleGroup[] } {
  let launches = input.launches.map((launch) => ({ ...launch }));
  let groups = input.groups.map((group) => ({
    ...group,
    support_crew_ids: [...group.support_crew_ids],
  }));
  const archived = new Set(input.archivedTaskIds);

  const syncGroupQuantities = (taskId: string, assetId: string) => {
    groups = groups.map((group) => {
      if (group.task_id !== taskId || group.asset_id !== assetId || group.archived_at !== null) {
        return group;
      }
      const count = launches.filter(
        (launch) => launch.battle_group_id === group.id && launch.archived_at === null,
      ).length;
      return count === group.uav_quantity ? group : { ...group, uav_quantity: count, updated_at: input.now };
    });
  };

  const scaleQuantity = (taskId: string, assetId: string, quantity: number, mgrs: string) => {
    const active = activeLaunches(launches, taskId, assetId);
    if (active.length > quantity) {
      const excess = active.length - quantity;
      const victims = [...active]
        .reverse()
        .filter((launch) => isPlannedUnprocessed(launch))
        .slice(0, excess);
      const drop = new Set(victims.map((launch) => launch.id));
      launches = launches.map((launch) =>
        drop.has(launch.id) ? { ...launch, archived_at: input.now, updated_at: input.now } : launch,
      );
      syncGroupQuantities(taskId, assetId);
      return;
    }
    if (active.length < quantity) {
      const missing = quantity - active.length;
      const group = groups
        .filter((item) => item.task_id === taskId && item.asset_id === assetId && item.archived_at === null)
        .sort((left, right) => left.created_at.localeCompare(right.created_at))
        .at(-1);
      if (!group) {
        return;
      }
      const ammo = defaultAmmo(input.assets, assetId);
      const created = Array.from({ length: missing }, (_, index) => {
        const record = createLaunchRecord(
          group,
          new Date(Date.parse(input.now) + index + 1).toISOString(),
          crypto.randomUUID(),
          mgrs,
        );
        return { ...record, ammo_model_id: ammo };
      });
      launches = [...created, ...launches];
      syncGroupQuantities(taskId, assetId);
    }
  };

  if (archived.size > 0) {
    launches = launches.map((launch) =>
      archived.has(launch.task_id) && launch.archived_at === null && launch.reported_at === null
        ? { ...launch, archived_at: input.now, updated_at: input.now }
        : launch,
    );
  }

  input.pairs.forEach((pair) => {
    const diff = pairAssets(pair.before.assets, pair.after.assets);
    const targetChanged = (pair.before.target_ids[0] ?? "") !== (pair.after.target_ids[0] ?? "");
    const pointsChanged = !sameIdList(pair.before.aiming_point_ids, pair.after.aiming_point_ids);
    const mgrs = resolveDefaultAimingMgrs(pair.after, input.aimingPoints, input.targets) ?? "";

    diff.updates.forEach(({ from, to }) => {
      if (from.asset_id !== to.asset_id) {
        const ammo = defaultAmmo(input.assets, to.asset_id);
        launches = launches.map((launch) => {
          if (
            launch.task_id !== pair.after.id ||
            launch.asset_id !== from.asset_id ||
            launch.archived_at !== null ||
            launch.reported_at !== null
          ) {
            return launch;
          }
          return withProcessedAt(
            {
              ...launch,
              asset_id: to.asset_id,
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
          group.task_id === pair.after.id && group.asset_id === from.asset_id && group.archived_at === null
            ? { ...group, asset_id: to.asset_id, updated_at: input.now }
            : group,
        );
      }
      scaleQuantity(pair.after.id, to.asset_id, to.quantity, mgrs);
    });

    diff.removed.forEach((asset) => {
      const groupIds = new Set(
        groups
          .filter(
            (group) =>
              group.task_id === pair.after.id && group.asset_id === asset.asset_id && group.archived_at === null,
          )
          .map((group) => group.id),
      );
      groups = groups.map((group) =>
        groupIds.has(group.id) ? { ...group, archived_at: input.now, updated_at: input.now } : group,
      );
      launches = launches.map((launch) =>
        launch.task_id === pair.after.id &&
        launch.asset_id === asset.asset_id &&
        launch.archived_at === null &&
        launch.reported_at === null
          ? { ...launch, archived_at: input.now, updated_at: input.now }
          : launch,
      );
    });

    diff.added.forEach((asset) => {
      scaleQuantity(pair.after.id, asset.asset_id, asset.quantity, mgrs);
    });

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
