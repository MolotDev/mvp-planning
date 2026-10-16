import { matchingReports } from "@/lib/reportAggregation";
import { allocationsForMission } from "@/lib/taskAllocations";
import { toReportDate } from "@/lib/reportFormat";
import type { Mission, Task } from "@/types/mission";
import type { Report } from "@/types/report";

export function missionTasks(mission: Mission, tasks: Task[]): Task[] {
  return tasks.filter(
    (task) => task.archived_at === null && allocationsForMission(task, mission.id).length > 0,
  );
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
