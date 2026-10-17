import { visibleBattleGroups } from "@/lib/battleGroup";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Task } from "@/types/mission";

export type LaunchPrepStatus = "ready" | "progress" | "empty";

export interface CrewAssetQuantity {
  assetId: string;
  quantity: number;
}

export interface CrewLaunchGroup {
  crewId: string;
  assets: CrewAssetQuantity[];
  launches: Launch[];
  readyCount: number;
  totalCount: number;
  isFullyReady: boolean;
}

function filled(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

export function launchPrepFields(launch: Launch): { serial: boolean; tracker: boolean; trajectory: boolean } {
  return {
    serial: filled(launch.asset_serial_number),
    tracker: filled(launch.tracker_model_serial_number),
    trajectory: filled(launch.trajectory_name),
  };
}

export function isLaunchEquipped(launch: Launch): boolean {
  const fields = launchPrepFields(launch);
  return fields.serial && fields.trajectory;
}

export function launchPrepStatus(launch: Launch): LaunchPrepStatus {
  const fields = launchPrepFields(launch);
  if (fields.serial && fields.trajectory) {
    return "ready";
  }
  if (!fields.serial && !fields.trajectory) {
    return "empty";
  }
  return "progress";
}

export interface LaunchSerialEntry {
  id: string;
  index: number;
  serial: string;
  tracker: string | null;
  crewId: string | null;
  crewName: string | null;
}

export function conflictingLaunchIndex(
  entries: LaunchSerialEntry[],
  launchId: string,
  field: "serial" | "tracker",
  value: string,
): {index: number | null, crewName: string | null} {
  const normalized = value.trim();
  if (!normalized) {
    return {index: null, crewName: null};
  }
  const match = entries.find((entry) => {
    if (entry.id === launchId) {
      return false;
    }
    const current = field === "serial" ? entry.serial : (entry.tracker ?? "");
    return current.trim() === normalized;
  });

  return {index: match?.index ?? null, crewName: match?.crewName ?? null};
}

export function groupLaunchesByCrew(task: Task, groups: BattleGroup[], launches: Launch[]): CrewLaunchGroup[] {
  const visibleGroups = visibleBattleGroups(task, groups).filter(
    (group) => group.task_id === task.id || task.battle_groups_ids.includes(group.id),
  );
  const byCrew = new Map<string, { assets: CrewAssetQuantity[]; groupIds: Set<string> }>();
  visibleGroups.forEach((group) => {
    const current = byCrew.get(group.lead_crew_id) ?? { assets: [], groupIds: new Set<string>() };
    const asset = current.assets.find((item) => item.assetId === group.asset_id);
    if (asset) {
      asset.quantity += group.uav_quantity;
    } else {
      current.assets.push({ assetId: group.asset_id, quantity: group.uav_quantity });
    }
    current.groupIds.add(group.id);
    byCrew.set(group.lead_crew_id, current);
  });
  const activeLaunches = launches.filter((launch) => launch.archived_at === null && launch.task_id === task.id);
  return [...byCrew.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([crewId, bucket]) => {
      const crewLaunches = activeLaunches
        .filter((launch) => bucket.groupIds.has(launch.battle_group_id))
        .sort((left, right) => left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id));
      const readyCount = crewLaunches.filter(isLaunchEquipped).length;
      return {
        crewId,
        assets: bucket.assets,
        launches: crewLaunches,
        readyCount,
        totalCount: crewLaunches.length,
        isFullyReady: readyCount === crewLaunches.length && crewLaunches.length > 0,
      };
    });
}
