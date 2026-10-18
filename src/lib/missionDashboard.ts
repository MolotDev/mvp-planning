import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Mission, Task, TaskAllocation } from "@/types/mission";
import { isLaunchEquipped, launchPrepStatus } from "@/lib/taskCrewMatrix";

export type PrepTone = "ready" | "progress" | "idle";
export type DetachmentTone = "ready" | "needs_allocation" | "progress";

export function prepTone(prepped: number, total: number): PrepTone {
  if (total > 0 && prepped >= total) {
    return "ready";
  }
  if (prepped > 0) {
    return "progress";
  }
  return "idle";
}

export function detachmentTone(assigned: number, prepped: number, planned: number): DetachmentTone {
  if (assigned < planned) {
    return "needs_allocation";
  }
  if (planned > 0 && prepped >= planned) {
    return "ready";
  }
  return "progress";
}

export function launchesForLine(task: Task, line: TaskAllocation, launches: Launch[]): Launch[] {
  const active = launches.filter((launch) => launch.archived_at === null && launch.task_id === task.id);
  const explicit = active.filter((launch) => launch.allocation_line_id === line.id);
  if (explicit.length > 0) {
    return explicit;
  }
  const sameAsset = task.allocations.filter(
    (item) => item.mission_id === line.mission_id && item.asset_id === line.asset_id,
  );
  if (sameAsset.length !== 1) {
    return [];
  }
  return active.filter((launch) => launch.allocation_line_id == null && launch.asset_id === line.asset_id);
}

export function assignedQuantity(task: Task, line: TaskAllocation, groups: BattleGroup[]): number {
  const sameAsset = task.allocations.filter(
    (item) => item.mission_id === line.mission_id && item.asset_id === line.asset_id,
  );
  return groups
    .filter((group) => group.archived_at === null && group.task_id === task.id)
    .filter((group) => {
      if (group.allocation_line_id === line.id) {
        return true;
      }
      return group.allocation_line_id == null && group.asset_id === line.asset_id && sameAsset.length === 1;
    })
    .reduce((sum, group) => sum + group.uav_quantity, 0);
}

export function equippedCount(launches: Launch[]): number {
  return launches.filter(isLaunchEquipped).length;
}

export interface CrewPrep {
  crewId: string;
  assigned: number;
  prepped: number;
}

export interface CrewReadiness {
  readyCrews: number;
  readyBoards: number;
  progressCrews: number;
  progressPrepped: number;
  progressAssigned: number;
  idleCrews: number;
  idleAssigned: number;
}

export type LinePrepState = "ready" | "progress" | "queued" | "needs_crew";

export function linePrepState(prepped: number, assigned: number, quantity: number): LinePrepState {
  if (quantity > 0 && prepped >= quantity) {
    return "ready";
  }
  if (prepped > 0) {
    return "progress";
  }
  if (assigned > 0) {
    return "queued";
  }
  return "needs_crew";
}

export interface PrepSegments {
  prepped: number;
  partial: number;
  untouched: number;
  unallocated: number;
}

export function prepSegmentsForLine(quantity: number, assigned: number, launches: Launch[]): PrepSegments {
  const planned = Math.max(0, quantity);
  const allocated = Math.min(Math.max(0, assigned), planned);
  const equipped = Math.min(equippedCount(launches), allocated);
  const partialCount = launches.filter((launch) => launchPrepStatus(launch) === "progress").length;
  const partial = Math.min(partialCount, Math.max(0, allocated - equipped));
  return {
    prepped: equipped,
    partial,
    untouched: Math.max(0, allocated - equipped - partial),
    unallocated: planned - allocated,
  };
}

export function sumPrepSegments(items: PrepSegments[]): PrepSegments {
  return items.reduce(
    (sum, item) => ({
      prepped: sum.prepped + item.prepped,
      partial: sum.partial + item.partial,
      untouched: sum.untouched + item.untouched,
      unallocated: sum.unallocated + item.unallocated,
    }),
    { prepped: 0, partial: 0, untouched: 0, unallocated: 0 },
  );
}

export function activeMissionTasks(mission: Mission, tasks: Task[]): Task[] {
  return tasks.filter(
    (task) => task.archived_at === null && task.allocations.some((line) => line.mission_id === mission.id),
  );
}

export function classifyCrewReadiness(crews: CrewPrep[]): CrewReadiness {
  const result: CrewReadiness = {
    readyCrews: 0,
    readyBoards: 0,
    progressCrews: 0,
    progressPrepped: 0,
    progressAssigned: 0,
    idleCrews: 0,
    idleAssigned: 0,
  };
  crews.forEach((crew) => {
    if (crew.assigned <= 0) {
      return;
    }
    if (crew.prepped >= crew.assigned) {
      result.readyCrews += 1;
      result.readyBoards += crew.assigned;
      return;
    }
    if (crew.prepped > 0) {
      result.progressCrews += 1;
      result.progressPrepped += crew.prepped;
      result.progressAssigned += crew.assigned;
      return;
    }
    result.idleCrews += 1;
    result.idleAssigned += crew.assigned;
  });
  return result;
}
