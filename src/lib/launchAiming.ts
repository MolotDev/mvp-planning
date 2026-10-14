import type { Launch } from "@/types/launch";
import type { Task } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";

export function taskAimingPoints(
  task: Pick<Task, "aiming_point_ids">,
  aimingPoints: AimingPoint[],
): AimingPoint[] {
  return task.aiming_point_ids
    .map((id) => aimingPoints.find((point) => point.id === id))
    .filter((point): point is AimingPoint => Boolean(point && point.archived_at === null));
}

export function resolveDefaultAimingMgrs(
  task: Pick<Task, "aiming_point_ids" | "target_ids"> | undefined,
  aimingPoints: AimingPoint[],
  targets: Target[],
): string | null {
  if (!task) {
    return null;
  }
  const points = taskAimingPoints(task, aimingPoints);
  if (points.length > 1) {
    return null;
  }
  if (points.length === 1) {
    return points[0].mgrs;
  }
  const target = targets.find((item) => task.target_ids.includes(item.id));
  return target?.mgrs ?? null;
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
