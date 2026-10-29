import { CHECKPOINTS } from "@/data/checkpoints";
import { PLANNED_LAUNCH_STATUS_ID } from "@/data/launchCatalog";
import { crewName } from "@/lib/battleGroup";
import { aggregateDay, type DaySlice, type PlanningSnapshot } from "@/lib/reportAggregation";
import type { ActualEvent, Report, Trajectory } from "@/types/report";

const RETURN_CHECKPOINT_ID = "checkpoint_3";
const RETURN_CHECKPOINT_NAME = CHECKPOINTS.find((item) => item.id === RETURN_CHECKPOINT_ID)?.name ?? "Повернення";

export function isEventTimeFilled(value: string | null | undefined): boolean {
  return /^\d{2}:\d{2}$/.test((value ?? "").trim());
}

/** Sortie started when the report has at least one event with a filled HH:MM time. */
export function isSortieStarted(report: Pick<Report, "actual_events">): boolean {
  return report.actual_events.some((event) => isEventTimeFilled(event.time));
}

function eventCheckpointLabel(event: ActualEvent): string {
  const parts = event.event_description.split(" - ");
  return (parts.slice(2).join(" - ") || "").trim();
}

function eventCrewLabels(event: ActualEvent): string[] {
  const parts = event.event_description.split(" - ");
  const crewsPart = parts[1] ?? "";
  if (!crewsPart || crewsPart === "{crews}") {
    return [];
  }
  return crewsPart.split(" / ").map((item) => item.trim()).filter(Boolean);
}

function isReturnCheckpoint(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return (
    normalized === RETURN_CHECKPOINT_ID.toLowerCase() ||
    normalized === RETURN_CHECKPOINT_NAME.toLowerCase() ||
    normalized.includes(RETURN_CHECKPOINT_NAME.toLowerCase())
  );
}

/** Every battle-group crew on the day must have a timed Повернення event. */
export function allCrewsReturnedToBase(report: Report, snapshot: PlanningSnapshot): boolean {
  const slice = aggregateDay(report.organization_id, report.report_date, snapshot);
  const crewLabels = [
    ...new Set(slice.battleGroups.map((group) => crewName(group.lead_crew_id)).filter(Boolean)),
  ];
  if (crewLabels.length === 0) {
    return false;
  }
  const returned = new Set<string>();
  report.actual_events.forEach((event) => {
    if (!isEventTimeFilled(event.time) || !isReturnCheckpoint(eventCheckpointLabel(event))) {
      return;
    }
    eventCrewLabels(event).forEach((label) => returned.add(label));
  });
  return crewLabels.every((label) => returned.has(label));
}

export function isReportSubmittable(report: Report, snapshot: PlanningSnapshot): boolean {
  if (report.archived_at !== null) {
    return false;
  }
  if (!report.analysis_timestamp || Number.isNaN(new Date(report.analysis_timestamp).getTime())) {
    return false;
  }
  const trajectories = report.trajectories.filter((trajectory) => trajectory.archived_at === null);
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
  const launchesReady = slice.launches.every((launch) => {
    const link = report.launches_by_trajectory.find((item) => item.launch_id === launch.id);
    if (!link || link.launch_number <= 0 || !link.launched_at) {
      return false;
    }
    return trajectories.some((trajectory) => trajectory.id === link.trajectory_id);
  });
  if (!launchesReady) {
    return false;
  }
  return allCrewsReturnedToBase(report, snapshot);
}

export function activeTrajectories(report: Report): Trajectory[] {
  return report.trajectories.filter((trajectory) => trajectory.archived_at === null);
}

export function sliceForReport(report: Report, snapshot: PlanningSnapshot): DaySlice {
  return aggregateDay(report.organization_id, report.report_date, snapshot);
}
