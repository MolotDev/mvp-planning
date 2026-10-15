import type { Launch } from "@/types/launch";
import type { Task } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";

export function taskAimingPoints(
  task: Pick<Task, "aiming_point_id">,
  aimingPoints: AimingPoint[],
): AimingPoint[] {
  if (!task.aiming_point_id) {
    return [];
  }
  const point = aimingPoints.find((item) => item.id === task.aiming_point_id && item.archived_at === null);
  return point ? [point] : [];
}

export function resolveDefaultAimingMgrs(
  task: Pick<Task, "aiming_point_id" | "target_ids"> | undefined,
  aimingPoints: AimingPoint[],
  targets: Target[],
): string | null {
  if (!task) {
    return null;
  }
  const [point] = taskAimingPoints(task, aimingPoints);
  if (point) {
    return point.mgrs;
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
