import { PLANNED_LAUNCH_STATUS_ID } from "@/data/launchCatalog";
import { aggregateDay, type DaySlice, type PlanningSnapshot } from "@/lib/reportAggregation";
import type { ActualEvent, Report, Trajectory } from "@/types/report";

export function isEventComplete(event: ActualEvent): boolean {
  return (
    /^\d{2}:\d{2}$/.test(event.time) &&
    /^\d{4}-\d{2}-\d{2}$/.test(event.date) &&
    event.event_description.trim() !== ""
  );
}

export function isReportSubmittable(report: Report, snapshot: PlanningSnapshot): boolean {
  if (report.status !== "draft" || report.archived_at !== null) {
    return false;
  }
  if (!report.analysis_timestamp || Number.isNaN(new Date(report.analysis_timestamp).getTime())) {
    return false;
  }
  const trajectories = report.trajectories.filter((trajectory) => trajectory.archived_at === null);
  if (!report.actual_events.length || !report.actual_events.every(isEventComplete)) {
    return false;
  }
  const slice = aggregateDay(report.organization_id, report.report_date, snapshot);
  if (slice.launches.length === 0 || slice.launches.some((launch) => (
    launch.launch_status_id === PLANNED_LAUNCH_STATUS_ID
    || !launch.launch_status_id?.trim()
  ))) {
    return false;
  }
  if (slice.launches.some((launch) => launch.launch_status_id === "problem" && !launch.cause_launch_problem_id?.trim())) {
    return false;
  }
  return slice.launches.every((launch) => {
    const link = report.launches_by_trajectory.find((item) => item.launch_id === launch.id);
    if (!link || link.launch_number <= 0 || !link.launched_at) {
      return false;
    }
    return trajectories.some((trajectory) => trajectory.id === link.trajectory_id);
  });
}

export function activeTrajectories(report: Report): Trajectory[] {
  return report.trajectories.filter((trajectory) => trajectory.archived_at === null);
}

export function sliceForReport(report: Report, snapshot: PlanningSnapshot): DaySlice {
  return aggregateDay(report.organization_id, report.report_date, snapshot);
}
