import { crewName, uavName } from "@/lib/battleGroup";
import { isDateInRange } from "@/lib/dates";
import { getEntityState } from "@/lib/entityState";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Mission, MissionMetrics, Task } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";

export function getLaunchStateMetrics(launches: Launch[]): MissionMetrics {
  return {
    total: launches.length,
    active: launches.filter((launch) => getEntityState(launch) === "active").length,
    reported: launches.filter((launch) => getEntityState(launch) === "reported").length,
    archived: launches.filter((launch) => getEntityState(launch) === "archived").length,
  };
}

export function launchQuantitySummary(launches: Launch[]): string {
  const totals = new Map<string, number>();
  launches
    .filter((launch) => launch.archived_at === null)
    .forEach((launch) => {
      totals.set(launch.asset_id, (totals.get(launch.asset_id) ?? 0) + 1);
    });
  if (totals.size === 0) {
    return "0";
  }
  return [...totals.entries()].map(([modelId, quantity]) => `${quantity} * ${uavName(modelId)}`).join(", ");
}

export function battleGroupCrewParts(group: BattleGroup | undefined): { lead: string; support: string[] } {
  if (!group) {
    return { lead: "", support: [] };
  }
  return {
    lead: crewName(group.lead_crew_id),
    support: group.support_crew_ids.map(crewName),
  };
}

export interface LaunchRowContext {
  launch: Launch;
  task: Task | undefined;
  mission: Mission | undefined;
  target: Target | undefined;
  aimingPoint: AimingPoint | undefined;
  battleGroup: BattleGroup | undefined;
}

export function buildLaunchContext(
  launch: Launch,
  tasks: Task[],
  missions: Mission[],
  targets: Target[],
  aimingPoints: AimingPoint[],
  battleGroups: BattleGroup[],
): LaunchRowContext {
  const task = tasks.find((item) => item.id === launch.task_id);
  const mission = missions.find((item) => item.id === task?.mission_id);
  const target = targets.find((item) => task?.target_ids.includes(item.id));
  const aimingPoint = aimingPoints.find(
    (point) => task?.aiming_point_ids.includes(point.id) && point.mgrs === launch.aiming_point_mgrs.trim(),
  );
  const battleGroup = battleGroups.find((group) => group.id === launch.battle_group_id);
  return { launch, task, mission, target, aimingPoint, battleGroup };
}

export function launchMatchesQuery(context: LaunchRowContext, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  const missionName = context.mission?.name ?? context.mission?.label ?? "";
  const target = context.target;
  return (
    missionName.toLowerCase().includes(q) ||
    (target?.name ?? "").toLowerCase().includes(q) ||
    (target?.displayed_id ?? "").toLowerCase().includes(q) ||
    (target?.mgrs ?? "").toLowerCase().includes(q) ||
    context.launch.aiming_point_mgrs.toLowerCase().includes(q)
  );
}

export function filterLaunchRows(
  launches: Launch[],
  tasks: Task[],
  missions: Mission[],
  targets: Target[],
  aimingPoints: AimingPoint[],
  battleGroups: BattleGroup[],
  query: string,
  from: Date | null,
  to: Date | null,
  organizationId: string,
  crewId: string,
  includeArchived = false,
): LaunchRowContext[] {
  return launches
    .filter((launch) => includeArchived || launch.archived_at === null)
    .map((launch) => buildLaunchContext(launch, tasks, missions, targets, aimingPoints, battleGroups))
    .filter((context) => {
      if (organizationId && context.task?.organization_id !== organizationId) {
        return false;
      }
      if (crewId) {
        const group = context.battleGroup;
        const crews = group ? [group.lead_crew_id, ...group.support_crew_ids] : [];
        if (!crews.includes(crewId)) {
          return false;
        }
      }
      const scheduledAt = context.mission?.scheduled_at ?? context.task?.created_at ?? context.launch.created_at;
      if (!isDateInRange(scheduledAt, from, to)) {
        return false;
      }
      return launchMatchesQuery(context, query);
    })
    .sort((left, right) => {
      const leftDate = left.mission?.scheduled_at ?? left.launch.created_at;
      const rightDate = right.mission?.scheduled_at ?? right.launch.created_at;
      const byDate = leftDate.localeCompare(rightDate);
      if (byDate !== 0) {
        return byDate;
      }
      const byCrew = battleGroupCrewParts(left.battleGroup).lead.localeCompare(
        battleGroupCrewParts(right.battleGroup).lead,
      );
      if (byCrew !== 0) {
        return byCrew;
      }
      return left.launch.created_at.localeCompare(right.launch.created_at);
    });
}
