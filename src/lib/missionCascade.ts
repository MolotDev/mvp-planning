import { allocationAimingMgrs } from "@/lib/launchAiming";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Task, TaskAllocation } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";

interface CascadeInput {
  beforeTasks: Task[];
  afterTasks: Task[];
  archivedTaskIds: string[];
  now: string;
  launches: Launch[];
  groups: BattleGroup[];
  targets: Target[];
  aimingPoints: AimingPoint[];
}

interface LinePlacement {
  task: Task;
  line: TaskAllocation;
}

function byCreatedAt(left: { created_at: string; id: string }, right: { created_at: string; id: string }): number {
  return right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id);
}

function linePlacements(tasks: Task[]): Map<string, LinePlacement> {
  const placements = new Map<string, LinePlacement>();
  tasks.forEach((task) => {
    task.allocations.forEach((line) => {
      placements.set(line.id, { task, line });
    });
  });
  return placements;
}

export function launchHasBoardIdentity(launch: Pick<Launch, "asset_serial_number" | "tracker_model_serial_number">): boolean {
  return Boolean(launch.asset_serial_number.trim() || (launch.tracker_model_serial_number ?? "").trim());
}

export function filledBoardCount(launches: Launch[]): number {
  return launches.filter((launch) => launch.archived_at === null && launchHasBoardIdentity(launch)).length;
}

function archiveLaunch(launch: Launch, now: string): Launch {
  return { ...launch, archived_at: now, updated_at: now };
}

function canRetire(launch: Launch): boolean {
  return launch.archived_at === null && launch.reported_at === null;
}

export function cascadeMissionAllocation(input: CascadeInput): { launches: Launch[]; groups: BattleGroup[] } {
  let launches = input.launches.map((launch) => ({ ...launch }));
  let groups = input.groups.map((group) => ({
    ...group,
    support_crew_ids: [...group.support_crew_ids],
  }));
  const archivedTasks = new Set(input.archivedTaskIds);
  const retireLaunchIds = new Set<string>();
  const retireGroupIds = new Set<string>();

  const retireLine = (placement: LinePlacement) => {
    const lineId = placement.line.id;
    const assetStillUsed = [...after.values()].some(
      (item) =>
        item.task.id === placement.task.id &&
        item.line.asset_id === placement.line.asset_id &&
        item.line.id !== lineId,
    );
    launches.forEach((launch) => {
      if (!canRetire(launch)) {
        return;
      }
      const explicit = launch.allocation_line_id === lineId;
      const legacy =
        !assetStillUsed &&
        launch.allocation_line_id == null &&
        launch.task_id === placement.task.id &&
        launch.asset_id === placement.line.asset_id;
      if (explicit || legacy) {
        retireLaunchIds.add(launch.id);
      }
    });
    groups.forEach((group) => {
      if (group.archived_at !== null) {
        return;
      }
      const explicit = group.allocation_line_id === lineId;
      const legacy =
        !assetStillUsed &&
        group.allocation_line_id == null &&
        group.task_id === placement.task.id &&
        group.asset_id === placement.line.asset_id;
      if (explicit || legacy) {
        retireGroupIds.add(group.id);
      }
    });
  };

  if (archivedTasks.size > 0) {
    launches.forEach((launch) => {
      if (archivedTasks.has(launch.task_id) && canRetire(launch)) {
        retireLaunchIds.add(launch.id);
      }
    });
  }

  const before = linePlacements(input.beforeTasks);
  const after = linePlacements(input.afterTasks);

  const soleAssetLine = (placement: LinePlacement) =>
    placement.task.allocations.filter((line) => line.asset_id === placement.line.asset_id).length === 1;

  const claimGroups = (placement: LinePlacement) => {
    const sole = soleAssetLine(placement);
    const groupIds = new Set<string>();
    groups = groups.map((group) => {
      if (group.archived_at !== null) {
        return group;
      }
      const explicit = group.allocation_line_id === placement.line.id;
      const legacy =
        sole &&
        group.allocation_line_id == null &&
        group.task_id === placement.task.id &&
        group.asset_id === placement.line.asset_id;
      if (!explicit && !legacy) {
        return group;
      }
      groupIds.add(group.id);
      if (group.allocation_line_id === placement.line.id && group.task_id === placement.task.id) {
        return group;
      }
      return {
        ...group,
        allocation_line_id: placement.line.id,
        task_id: placement.task.id,
        updated_at: input.now,
      };
    });
    return groupIds;
  };

  const belongsToLine = (launch: Launch, placement: LinePlacement, groupIds: Set<string>) => {
    if (launch.allocation_line_id === placement.line.id) {
      return true;
    }
    if (launch.allocation_line_id != null) {
      return false;
    }
    if (groupIds.has(launch.battle_group_id)) {
      return true;
    }
    return (
      soleAssetLine(placement) &&
      launch.task_id === placement.task.id &&
      launch.asset_id === placement.line.asset_id
    );
  };

  const applyAiming = (placement: LinePlacement) => {
    const mgrs = allocationAimingMgrs(placement.line, input.aimingPoints, input.targets) ?? "";
    const groupIds = claimGroups(placement);
    launches = launches.map((launch) =>
      belongsToLine(launch, placement, groupIds) && canRetire(launch)
        ? {
            ...launch,
            aiming_point_mgrs: mgrs,
            allocation_line_id: placement.line.id,
            task_id: placement.task.id,
            updated_at: input.now,
          }
        : launch,
    );
  };

  const applyQuantity = (placement: LinePlacement, removed: number) => {
    if (removed <= 0) {
      return;
    }
    const groupIds = claimGroups(placement);
    const unfilled = launches
      .filter(
        (launch) =>
          belongsToLine(launch, placement, groupIds) &&
          canRetire(launch) &&
          !launchHasBoardIdentity(launch) &&
          !retireLaunchIds.has(launch.id),
      )
      .sort(byCreatedAt)
      .slice(0, removed);
    unfilled.forEach((launch) => retireLaunchIds.add(launch.id));
    const touchedGroups = new Set(unfilled.map((launch) => launch.battle_group_id));
    groups = groups.map((group) => {
      if (!touchedGroups.has(group.id) || group.archived_at !== null) {
        return group;
      }
      const kept = launches.filter(
        (launch) => launch.battle_group_id === group.id && launch.archived_at === null && !retireLaunchIds.has(launch.id),
      ).length;
      if (kept <= 0) {
        retireGroupIds.add(group.id);
        return group;
      }
      return { ...group, uav_quantity: kept, updated_at: input.now };
    });
  };

  const adoptLine = (previous: LinePlacement, next: LinePlacement) => {
    const groupIds = claimGroups(previous);
    groups = groups.map((group) =>
      groupIds.has(group.id)
        ? {
            ...group,
            allocation_line_id: next.line.id,
            task_id: next.task.id,
            updated_at: input.now,
          }
        : group,
    );
    launches = launches.map((launch) =>
      belongsToLine(launch, previous, groupIds) && canRetire(launch)
        ? {
            ...launch,
            allocation_line_id: next.line.id,
            task_id: next.task.id,
            updated_at: input.now,
          }
        : launch,
    );
  };

  const syncContinuingLine = (previous: LinePlacement, next: LinePlacement) => {
    const aimingChanged =
      previous.line.aiming_point_id !== next.line.aiming_point_id || previous.line.target_id !== next.line.target_id;
    if (aimingChanged) {
      applyAiming(next);
    }
    applyQuantity(next, previous.line.quantity - next.line.quantity);
  };

  const removed: LinePlacement[] = [];
  before.forEach((placement, lineId) => {
    if (!after.has(lineId)) {
      removed.push(placement);
    }
  });
  const added: LinePlacement[] = [];
  after.forEach((placement, lineId) => {
    if (!before.has(lineId)) {
      added.push(placement);
    }
  });
  const adoptedAdded = new Set<string>();
  removed.forEach((previous) => {
    const pool = added.filter(
      (item) =>
        !adoptedAdded.has(item.line.id) &&
        item.task.organization_id === previous.task.organization_id &&
        item.line.asset_id === previous.line.asset_id,
    );
    const continuation = pool.find((item) => item.line.target_id === previous.line.target_id) ?? pool[0];
    if (!continuation) {
      retireLine(previous);
      return;
    }
    adoptedAdded.add(continuation.line.id);
    adoptLine(previous, continuation);
    syncContinuingLine(previous, continuation);
  });

  after.forEach((next, lineId) => {
    const previous = before.get(lineId);
    if (!previous || adoptedAdded.has(lineId)) {
      return;
    }
    const organizationChanged = previous.task.organization_id !== next.task.organization_id;
    const assetChanged = previous.line.asset_id !== next.line.asset_id;
    if (organizationChanged || assetChanged) {
      retireLine(previous);
      return;
    }
    syncContinuingLine(previous, next);
  });

  retireGroupIds.forEach((groupId) => {
    launches.forEach((launch) => {
      if (launch.battle_group_id === groupId && canRetire(launch)) {
        retireLaunchIds.add(launch.id);
      }
    });
  });

  launches = launches.map((launch) => (retireLaunchIds.has(launch.id) ? archiveLaunch(launch, input.now) : launch));
  groups = groups.map((group) =>
    retireGroupIds.has(group.id) ? { ...group, uav_quantity: 0, archived_at: input.now, updated_at: input.now } : group,
  );

  return { launches, groups };
}
