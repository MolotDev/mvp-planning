import { operationalDay } from "@/lib/battleGroup";
import type { Launch } from "@/types/launch";
import type { Task, TaskAllocation } from "@/types/mission";

export function sameOperationalDay(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftDay = operationalDay(left);
  const rightDay = operationalDay(right);
  return Boolean(leftDay) && leftDay === rightDay;
}

export function taskMissionIds(task: Pick<Task, "allocations">): string[] {
  const ids: string[] = [];
  task.allocations.forEach((line) => {
    if (line.mission_id && !ids.includes(line.mission_id)) {
      ids.push(line.mission_id);
    }
  });
  return ids;
}

export function taskTargetIds(task: Pick<Task, "allocations">): string[] {
  const ids: string[] = [];
  task.allocations.forEach((line) => {
    if (line.target_id && !ids.includes(line.target_id)) {
      ids.push(line.target_id);
    }
  });
  return ids;
}

export function taskQuantity(task: Pick<Task, "allocations">): number {
  return task.allocations.reduce((sum, line) => sum + (line.quantity > 0 ? line.quantity : 0), 0);
}

export function allocationsForMission(task: Pick<Task, "allocations">, missionId: string): TaskAllocation[] {
  return task.allocations.filter((line) => line.mission_id === missionId);
}

export function launchesForMission(launches: Launch[], tasks: Pick<Task, "allocations">[], missionId: string): Launch[] {
  const lineIds = new Set(
    tasks.flatMap((task) => allocationsForMission(task, missionId).map((line) => line.id)),
  );
  return launches.filter(
    (launch) =>
      launch.archived_at === null &&
      launch.allocation_line_id !== null &&
      lineIds.has(launch.allocation_line_id),
  );
}
