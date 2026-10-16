import { toReportDate } from "@/lib/reportFormat";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Mission, Task } from "@/types/mission";
import type { LaunchTrajectoryLink, Report, ReportMetrics, Trajectory } from "@/types/report";
import type { Target } from "@/types/target";

export interface PlanningSnapshot {
  missions: Mission[];
  tasks: Task[];
  targets: Target[];
  battleGroups: BattleGroup[];
  launches: Launch[];
}

export interface DaySlice {
  missions: Mission[];
  tasks: Task[];
  targets: Target[];
  battleGroups: BattleGroup[];
  launches: Launch[];
}

export interface CrewLaunchSummary {
  assetId: string;
  crewId: string;
  successful: number;
  failed: number;
  total: number;
}

function compareTasks(left: Task, right: Task): number {
  const bySchedule = (left.scheduled_at || left.created_at).localeCompare(right.scheduled_at || right.created_at);
  if (bySchedule !== 0) {
    return bySchedule;
  }
  const byCreated = left.created_at.localeCompare(right.created_at);
  if (byCreated !== 0) {
    return byCreated;
  }
  return left.id.localeCompare(right.id);
}

export function aggregateDay(
  organizationId: string,
  reportDate: string,
  snapshot: PlanningSnapshot,
): DaySlice {
  const tasks = snapshot.tasks
    .filter((task) => {
      if (task.archived_at !== null || task.organization_id !== organizationId) {
        return false;
      }
      if (!task.scheduled_at || toReportDate(task.scheduled_at) !== reportDate) {
        return false;
      }
      return task.allocations.some((line) => {
        const mission = snapshot.missions.find((item) => item.id === line.mission_id);
        return mission != null && mission.archived_at === null;
      });
    })
    .sort((left, right) => compareTasks(left, right));
  const taskIds = new Set(tasks.map((task) => task.id));
  const missionIds = new Set(tasks.flatMap((task) => task.allocations.map((line) => line.mission_id)));
  const missions = snapshot.missions
    .filter((mission) => mission.archived_at === null && missionIds.has(mission.id))
    .sort((left, right) => left.scheduled_at.localeCompare(right.scheduled_at) || left.id.localeCompare(right.id));
  const targetIds: string[] = [];
  tasks.forEach((task) => {
    task.allocations.forEach((line) => {
      const targetId = line.target_id;
      if (targetId && !targetIds.includes(targetId)) {
        targetIds.push(targetId);
      }
    });
  });
  const targets = targetIds.flatMap((targetId) => {
    const target = snapshot.targets.find((item) => item.id === targetId);
    return target ? [target] : [];
  });
  const taskOrder = new Map(tasks.map((task, index) => [task.id, index]));
  const battleGroups = snapshot.battleGroups
    .filter((group) => group.archived_at === null && taskIds.has(group.task_id))
    .sort((left, right) => {
      const byTask = (taskOrder.get(left.task_id) ?? 0) - (taskOrder.get(right.task_id) ?? 0);
      if (byTask !== 0) {
        return byTask;
      }
      return left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id);
    });
  const launches = snapshot.launches
    .filter((launch) => launch.archived_at === null && taskIds.has(launch.task_id))
    .sort((left, right) => left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id));
  return { missions, tasks, targets, battleGroups, launches };
}

export function dayTargetRoles(slice: DaySlice): { primary: Target | null; additional: Target[] } {
  const [primary = null, ...additional] = slice.targets;
  return { primary, additional };
}

export function deriveReportMetrics(slice: DaySlice): ReportMetrics {
  const successful = slice.launches.filter((launch) => launch.launch_status_id === "success").length;
  const failed = slice.launches.filter((launch) => launch.launch_status_id === "problem").length;
  const cancelled = slice.launches.filter((launch) => launch.launch_status_id === "abort").length;
  const rated = successful + failed;
  return {
    total_missions_count: slice.missions.length,
    total_tasks_count: slice.tasks.length,
    total_launches_count: slice.launches.length,
    successful_launches_count: successful,
    cancelled_launches_count: cancelled,
    failed_launches_count: failed,
    success_rate: rated > 0 ? Math.round((successful / rated) * 100) : 0,
    fail_rate: rated > 0 ? Math.round((failed / rated) * 100) : 0,
  };
}

export function summarizeLaunchesByCrew(slice: DaySlice): CrewLaunchSummary[] {
  const groups = new Map<string, CrewLaunchSummary>();
  slice.launches.forEach((launch) => {
    const battleGroup = slice.battleGroups.find((group) => group.id === launch.battle_group_id);
    const crewId = battleGroup?.lead_crew_id ?? "";
    const key = `${launch.asset_id}:${crewId}`;
    const current = groups.get(key) ?? {
      assetId: launch.asset_id,
      crewId,
      successful: 0,
      failed: 0,
      total: 0,
    };
    if (launch.launch_status_id === "success") {
      current.total += 1;
      current.successful += 1;
    }
    if (launch.launch_status_id === "problem") {
      current.total += 1;
      current.failed += 1;
    }
    groups.set(key, current);
  });
  return [...groups.values()];
}

export function trajectoryPresets(slice: DaySlice): { battle_group_id: string; asset_id: string } {
  const battleGroupId = slice.battleGroups.length === 1 ? slice.battleGroups[0].id : "";
  if (battleGroupId) {
    return {
      battle_group_id: battleGroupId,
      asset_id: slice.battleGroups[0]?.asset_id ?? "",
    };
  }
  const assetIds = [...new Set(slice.battleGroups.map((group) => group.asset_id).filter(Boolean))];
  return {
    battle_group_id: "",
    asset_id: assetIds.length === 1 ? assetIds[0] : "",
  };
}

export function syncTrajectoriesFromLaunches(
  existing: Trajectory[],
  launches: Launch[],
  now: string,
): Trajectory[] {
  const names: string[] = [];
  launches.forEach((launch) => {
    const name = launch.trajectory_name?.trim() ?? "";
    if (name && !names.includes(name)) {
      names.push(name);
    }
  });
  const active = existing.filter((trajectory) => trajectory.archived_at === null);
  const tableId = active.find((trajectory) => trajectory.table_id)?.table_id ?? crypto.randomUUID();
  return names.map((name) => {
    const found = active.find((trajectory) => trajectory.name.trim() === name);
    if (found) {
      return found.table_id === tableId ? found : { ...found, table_id: tableId };
    }
    return {
      ...blankTrajectory(tableId, now, { battle_group_id: "", asset_id: "" }),
      name,
    };
  });
}

export function sameTrajectories(left: Trajectory[], right: Trajectory[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((trajectory, index) => {
    const other = right[index];
    return (
      trajectory.id === other.id &&
      trajectory.name === other.name &&
      trajectory.table_id === other.table_id &&
      trajectory.archived_at === other.archived_at
    );
  });
}

export function mergeLaunchLinks(
  report: Pick<Report, "trajectories" | "launches_by_trajectory">,
  launches: Launch[],
  nowIso: string,
): LaunchTrajectoryLink[] {
  const byName = new Map<string, string>();
  report.trajectories.forEach((trajectory) => {
    const name = trajectory.archived_at === null ? trajectory.name.trim() : "";
    if (name && !byName.has(name)) {
      byName.set(name, trajectory.id);
    }
  });
  const sequence = new Map<string, number>();
  return launches.map((launch) => {
    const existing = report.launches_by_trajectory.find((link) => link.launch_id === launch.id);
    const nextNumber = (sequence.get(launch.asset_id) ?? 0) + 1;
    sequence.set(launch.asset_id, nextNumber);
    return {
      launch_id: launch.id,
      trajectory_id: byName.get(launch.trajectory_name?.trim() ?? "") ?? "",
      launch_number: existing && existing.launch_number > 0 ? existing.launch_number : nextNumber,
      launched_at: existing?.launched_at || nowIso,
    };
  });
}

export function sameLaunchLinks(left: LaunchTrajectoryLink[], right: LaunchTrajectoryLink[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((link, index) => {
    const other = right[index];
    return (
      link.launch_id === other.launch_id &&
      link.trajectory_id === other.trajectory_id &&
      link.launch_number === other.launch_number &&
      link.launched_at === other.launched_at
    );
  });
}

export function blankTrajectory(
  tableId: string,
  now: string,
  preset: { battle_group_id: string; asset_id: string },
): Trajectory {
  return {
    id: crypto.randomUUID(),
    table_id: tableId,
    name: "",
    battle_group_id: preset.battle_group_id,
    asset_id: preset.asset_id,
    distance: 0,
    trajectory_height: "",
    height_above_hot_point: "",
    hot_point_cross_line: "",
    duration: "",
    time_on_target: "",
    created_at: now,
    updated_at: now,
    archived_at: null,
  };
}

export function matchingReports(
  reports: Report[],
  organizationIds: string[],
  scheduledAt: string | null | undefined,
): Report[] {
  if (!scheduledAt) {
    return [];
  }
  const reportDate = toReportDate(scheduledAt);
  const organizations = new Set(organizationIds.filter(Boolean));
  return reports.filter(
    (report) =>
      report.archived_at === null &&
      report.status !== "archived" &&
      report.report_date === reportDate &&
      organizations.has(report.organization_id),
  );
}

export function crewRate(summary: CrewLaunchSummary): number {
  if (summary.total <= 0) {
    return 0;
  }
  return Math.round((summary.successful / summary.total) * 100);
}
