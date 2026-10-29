import { matchingReports } from "@/lib/reportAggregation";
import { allocationsForMission, sameOperationalDay, taskBelongsToMission } from "@/lib/taskAllocations";
import { toReportDate } from "@/lib/reportFormat";
import type { Launch } from "@/types/launch";
import type { Mission, Task } from "@/types/mission";
import type { Report } from "@/types/report";

export function missionTasks(mission: Mission, tasks: Task[]): Task[] {
  return tasks.filter(
    (task) => task.archived_at === null && allocationsForMission(task, mission.id).length > 0,
  );
}

/** Active flight requests linked to the mission (by id / allocations) or same operational day for participant orgs. */
export function relatedTasksForMissionConfirmation(mission: Mission, tasks: Task[]): Task[] {
  const linked = tasks.filter(
    (task) => task.archived_at === null && taskBelongsToMission(task, mission),
  );
  const participantOrgs = new Set(linked.map((task) => task.organization_id));
  const byDay = tasks.filter(
    (task) =>
      task.archived_at === null &&
      participantOrgs.has(task.organization_id) &&
      sameOperationalDay(task.scheduled_at || task.created_at, mission.scheduled_at),
  );
  const byId = new Map<string, Task>();
  [...linked, ...byDay].forEach((task) => byId.set(task.id, task));
  return [...byId.values()];
}

export function relatedLaunchIdsForMissionConfirmation(
  mission: Mission,
  tasks: Task[],
  launches: Launch[],
): string[] {
  const relatedTasks = relatedTasksForMissionConfirmation(mission, tasks);
  const taskIds = new Set(relatedTasks.map((task) => task.id));
  const lineIds = new Set(
    relatedTasks.flatMap((task) => {
      const forMission = allocationsForMission(task, mission.id);
      const lines = forMission.length > 0 ? forMission : task.allocations;
      return lines.map((line) => line.id);
    }),
  );
  return launches
    .filter(
      (launch) =>
        launch.archived_at === null &&
        (taskIds.has(launch.task_id) ||
          (launch.allocation_line_id != null && lineIds.has(launch.allocation_line_id))),
    )
    .map((launch) => launch.id);
}

export function taskReportSubmitted(task: Task, mission: Mission, reports: Report[]): boolean {
  return matchingReports(reports, [task.organization_id], mission.scheduled_at).some(
    (report) => report.status === "submitted",
  );
}

export function allMissionReportsSubmitted(mission: Mission, tasks: Task[], reports: Report[]): boolean {
  const related = missionTasks(mission, tasks);
  return related.length > 0 && related.every((task) => taskReportSubmitted(task, mission, reports));
}

export function missionHasSubmittedReport(mission: Mission, tasks: Task[], reports: Report[]): boolean {
  return missionTasks(mission, tasks).some((task) => taskReportSubmitted(task, mission, reports));
}

export function isMissionPlanningLocked(mission: Mission, tasks: Task[], reports: Report[]): boolean {
  return (
    mission.archived_at !== null ||
    mission.reported_at !== null ||
    mission.confirmed_at !== null ||
    missionHasSubmittedReport(mission, tasks, reports)
  );
}

export function missionsCoveredByReport(report: Report, missions: Mission[], tasks: Task[]): Mission[] {
  return missions.filter((mission) => {
    if (toReportDate(mission.scheduled_at) !== report.report_date) {
      return false;
    }
    return tasks.some(
      (task) =>
        task.archived_at === null &&
        task.organization_id === report.organization_id &&
        allocationsForMission(task, mission.id).length > 0,
    );
  });
}

export function isReportLockedByConfirmation(report: Report, missions: Mission[], tasks: Task[]): boolean {
  return missionsCoveredByReport(report, missions, tasks).some((mission) => mission.confirmed_at !== null);
}

/** Draft or submitted report may be edited until archived or locked by mission confirmation. */
export function isReportEditable(report: Report, missions: Mission[], tasks: Task[]): boolean {
  if (report.archived_at !== null || report.status === "archived") {
    return false;
  }
  if (report.status !== "draft" && report.status !== "submitted") {
    return false;
  }
  return !isReportLockedByConfirmation(report, missions, tasks);
}
