import type { Launch } from "@/types/launch";
import type { Task, TaskAllocation } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";

export function allocationAimingMgrs(
  line: Pick<TaskAllocation, "aiming_point_id" | "target_id"> | undefined,
  aimingPoints: AimingPoint[],
  targets: Target[],
): string | null {
  if (!line) {
    return null;
  }
  const point = line.aiming_point_id
    ? aimingPoints.find((item) => item.id === line.aiming_point_id && item.archived_at === null)
    : undefined;
  if (point) {
    return point.mgrs;
  }
  return targets.find((item) => item.id === line.target_id)?.mgrs ?? null;
}

export function taskAimingPoints(
  task: Pick<Task, "allocations">,
  aimingPoints: AimingPoint[],
): AimingPoint[] {
  const ids = task.allocations.map((line) => line.aiming_point_id).filter((id): id is string => Boolean(id));
  return aimingPoints.filter((point) => point.archived_at === null && ids.includes(point.id));
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
