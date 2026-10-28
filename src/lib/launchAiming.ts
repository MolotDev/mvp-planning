import { asAimingCode, findAimingPointByRef } from "@/lib/aimingPointCode";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Task, TaskAllocation } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";

export function compactMgrs(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function allocationForLaunch(
  task: Pick<Task, "allocations"> | undefined,
  launch: Pick<Launch, "allocation_line_id" | "asset_id">,
  battleGroup: Pick<BattleGroup, "allocation_line_id" | "asset_id"> | undefined,
): TaskAllocation | undefined {
  if (!task) {
    return undefined;
  }
  if (launch.allocation_line_id) {
    const explicit = task.allocations.find((line) => line.id === launch.allocation_line_id);
    if (explicit) {
      return explicit;
    }
  }
  if (battleGroup?.allocation_line_id) {
    const byGroup = task.allocations.find((line) => line.id === battleGroup.allocation_line_id);
    if (byGroup) {
      return byGroup;
    }
  }
  const assetId = battleGroup?.asset_id || launch.asset_id;
  const sameAsset = task.allocations.filter((line) => line.asset_id === assetId);
  return sameAsset.length === 1 ? sameAsset[0] : undefined;
}

export function resolveLaunchAimingPoint(
  task: Pick<Task, "allocations"> | undefined,
  launch: Pick<Launch, "allocation_line_id" | "asset_id" | "aiming_point_mgrs">,
  battleGroup: Pick<BattleGroup, "allocation_line_id" | "asset_id"> | undefined,
  aimingPoints: AimingPoint[],
): AimingPoint | undefined {
  const line = allocationForLaunch(task, launch, battleGroup);
  if (line?.aiming_point_id) {
    const fromLine = findAimingPointByRef(aimingPoints, line.aiming_point_id, line.target_id);
    if (fromLine) {
      return fromLine;
    }
  }
  const compact = compactMgrs(launch.aiming_point_mgrs);
  if (!compact || !task) {
    return undefined;
  }
  const refs = new Set(
    task.allocations
      .map((item) => item.aiming_point_id)
      .filter((id): id is string => Boolean(id))
      .map((id) => asAimingCode(id)),
  );
  return aimingPoints.find((point) => {
    if (point.archived_at !== null || compactMgrs(point.mgrs) !== compact) {
      return false;
    }
    if (refs.has(asAimingCode(point.id)) || refs.has(asAimingCode(point.displayed_id))) {
      return true;
    }
    return task.allocations.some(
      (item) => item.aiming_point_id === point.id || item.target_id === point.target_id,
    );
  });
}

export function allocationAimingMgrs(
  line: Pick<TaskAllocation, "aiming_point_id" | "target_id"> | undefined,
  aimingPoints: AimingPoint[],
  targets: Target[],
): string | null {
  if (!line) {
    return null;
  }
  const point = findAimingPointByRef(aimingPoints, line.aiming_point_id, line.target_id);
  if (point) {
    return point.mgrs;
  }
  return targets.find((item) => item.id === line.target_id)?.mgrs ?? null;
}

export function taskAimingPoints(
  task: Pick<Task, "allocations">,
  aimingPoints: AimingPoint[],
): AimingPoint[] {
  const refs = task.allocations
    .map((line) => line.aiming_point_id)
    .filter((id): id is string => Boolean(id));
  const matched = new Map<string, AimingPoint>();
  refs.forEach((ref) => {
    const line = task.allocations.find((item) => item.aiming_point_id === ref);
    const point = findAimingPointByRef(aimingPoints, ref, line?.target_id);
    if (point) {
      matched.set(point.id, point);
    }
  });
  return [...matched.values()];
}

export function resolveDefaultAimingMgrs(
  task: Pick<Task, "allocations"> | undefined,
  aimingPoints: AimingPoint[],
  targets: Target[],
): string | null {
  return allocationAimingMgrs(task?.allocations[0], aimingPoints, targets);
}

export function isAimingPointAssigned(point: AimingPoint, taskId: string, launches: Launch[]): boolean {
  return launches.some(
    (launch) =>
      launch.task_id === taskId &&
      launch.archived_at === null &&
      launch.aiming_point_mgrs.trim() === point.mgrs,
  );
}

export function applyDefaultAimingMgrs(launches: Launch[], groupId: string, defaultMgrs: string | null): Launch[] {
  if (!defaultMgrs) {
    return launches;
  }
  return launches.map((launch) =>
    launch.battle_group_id === groupId &&
    launch.archived_at === null &&
    launch.reported_at === null &&
    !launch.aiming_point_mgrs.trim()
      ? { ...launch, aiming_point_mgrs: defaultMgrs }
      : launch,
  );
}
