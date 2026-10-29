import { DICTIONARY } from "@/constants/dictionary";
import { DEFAULT_LAUNCH_TIME, formatTimeInput, combineDateAndTime } from "@/lib/reportFormat";
import { isSortieStarted } from "@/lib/reportValidation";
import { findTrackerByRef } from "@/lib/trackerPool";
import type { CancellationInitiatorRole, CancellationMetadata, CancellationOutcome } from "@/types/cancellation";
import type { Launch } from "@/types/launch";
import type { Report, LaunchTrajectoryLink } from "@/types/report";
import type { Tracker } from "@/types/tracker";

const NON_COMPLETED_STATUSES = new Set(["", "planned", "abort"]);

export interface CancellationLaunchView {
  id: string;
  launch_status_id: string;
  launch_time: string;
  tracker_serial: string | null;
}

export function initiatorLabel(role: CancellationInitiatorRole): string {
  return role === "CENTER"
    ? DICTIONARY.common.roles.center_duty
    : DICTIONARY.common.roles.detachment_duty;
}

export function isCompletedLaunchForCancellation(launch: CancellationLaunchView): boolean {
  const status = (launch.launch_status_id ?? "").trim();
  const time = (launch.launch_time ?? "").trim();
  if (NON_COMPLETED_STATUSES.has(status)) {
    return false;
  }
  if (!time || time === DEFAULT_LAUNCH_TIME) {
    return false;
  }
  return true;
}

export function buildCancellationLaunchViews(
  launches: Launch[],
  links: LaunchTrajectoryLink[],
): CancellationLaunchView[] {
  return launches.map((launch) => {
    const link = links.find((item) => item.launch_id === launch.id);
    return {
      id: launch.id,
      launch_status_id: launch.launch_status_id,
      launch_time: formatTimeInput(link?.launched_at ?? "") || DEFAULT_LAUNCH_TIME,
      tracker_serial: launch.tracker_model_serial_number,
    };
  });
}

export function resolveCancellationOutcome(
  sortieStarted: boolean,
  launches: CancellationLaunchView[],
): CancellationOutcome {
  if (!sortieStarted) {
    return "cancelled_before_exit";
  }
  const completed = launches.filter(isCompletedLaunchForCancellation);
  return completed.length > 0 ? "partially_completed" : "cancelled_without_launches";
}

export function buildCancellationMetadata(input: {
  reason: string;
  role: CancellationInitiatorRole;
  cancelTime: string;
  outcome: CancellationOutcome;
  now?: string;
}): CancellationMetadata {
  return {
    reason: input.reason.trim(),
    initiator: initiatorLabel(input.role),
    initiator_role: input.role,
    cancel_time: input.cancelTime.trim() || DEFAULT_LAUNCH_TIME,
    cancelled_at: input.now ?? new Date().toISOString(),
    outcome: input.outcome,
  };
}

export function applyLaunchCancellationPatches(
  launches: CancellationLaunchView[],
  cancelTime: string,
): Array<{ id: string; status: "abort" | "keep"; launch_time: string }> {
  return launches.map((launch) => {
    if (isCompletedLaunchForCancellation(launch)) {
      return { id: launch.id, status: "keep", launch_time: launch.launch_time };
    }
    return {
      id: launch.id,
      status: "abort",
      launch_time: cancelTime.trim() || DEFAULT_LAUNCH_TIME,
    };
  });
}

function releaseTrackerFields(tracker: Tracker): Tracker {
  return {
    ...tracker,
    status: "available",
    assigned_mission_id: null,
    assigned_task_id: null,
    assigned_launch_id: null,
    assigned_asset_id: null,
  };
}

function trackerForLaunch(trackers: Tracker[], launch: CancellationLaunchView): Tracker | undefined {
  const bySerial = findTrackerByRef(trackers, launch.tracker_serial);
  if (bySerial) {
    return bySerial;
  }
  return trackers.find((item) => item.assigned_launch_id === launch.id);
}

export function applyTrackerCancellation(
  trackers: Tracker[],
  launches: CancellationLaunchView[],
  patches: Array<{ id: string; status: "abort" | "keep" }>,
  mode: CancellationOutcome,
): Tracker[] {
  if (mode === "cancelled_before_exit") {
    const launchIds = new Set(launches.map((item) => item.id));
    const serialRefs = new Set(
      launches.map((item) => (item.tracker_serial ?? "").trim()).filter(Boolean),
    );
    return trackers.map((tracker) => {
      if (tracker.status === "expended") {
        return tracker;
      }
      const byLaunch = tracker.assigned_launch_id != null && launchIds.has(tracker.assigned_launch_id);
      const bySerial = serialRefs.has(tracker.number) || serialRefs.has(tracker.id);
      return byLaunch || bySerial ? releaseTrackerFields(tracker) : tracker;
    });
  }

  const completedIds = new Set(
    patches.filter((item) => item.status === "keep").map((item) => item.id),
  );
  const abortedIds = new Set(
    patches.filter((item) => item.status === "abort").map((item) => item.id),
  );
  const completedTrackerIds = new Set<string>();
  const abortedTrackerIds = new Set<string>();

  launches.forEach((launch) => {
    const tracker = trackerForLaunch(trackers, launch);
    if (!tracker) {
      return;
    }
    if (completedIds.has(launch.id)) {
      completedTrackerIds.add(tracker.id);
    } else if (abortedIds.has(launch.id)) {
      abortedTrackerIds.add(tracker.id);
    }
  });

  // Also free any tracker still assigned to an aborted launch even if serial lookup missed.
  trackers.forEach((tracker) => {
    if (
      tracker.assigned_launch_id &&
      abortedIds.has(tracker.assigned_launch_id) &&
      tracker.status !== "expended"
    ) {
      abortedTrackerIds.add(tracker.id);
    }
  });

  return trackers.map((tracker) => {
    if (completedTrackerIds.has(tracker.id)) {
      return { ...tracker, status: "expended" };
    }
    if (abortedTrackerIds.has(tracker.id)) {
      return releaseTrackerFields(tracker);
    }
    return tracker;
  });
}

export function handleMissionCancellation(input: {
  report: Report | null | undefined;
  launches: Launch[];
  links: LaunchTrajectoryLink[];
  trackers: Tracker[];
  cancelTime: string;
  reason: string;
  role: CancellationInitiatorRole;
  reportDate?: string;
  now?: string;
}) {
  const views = buildCancellationLaunchViews(input.launches, input.links);
  const sortieStarted = input.report ? isSortieStarted(input.report) : false;
  const outcome = resolveCancellationOutcome(sortieStarted, views);
  const metadata = buildCancellationMetadata({
    reason: input.reason,
    role: input.role,
    cancelTime: input.cancelTime,
    outcome,
    now: input.now,
  });

  if (outcome === "cancelled_before_exit") {
    const trackers = applyTrackerCancellation(input.trackers, views, [], outcome);
    return {
      outcome,
      metadata,
      shouldSubmitReport: false,
      releaseCrews: true,
      launchPatches: [] as Array<{ id: string; status: "abort" | "keep"; launch_time: string }>,
      trackers,
      launchedAtPatches: [] as Array<{ launch_id: string; launched_at: string }>,
    };
  }

  const launchPatches = applyLaunchCancellationPatches(views, metadata.cancel_time);
  const trackers = applyTrackerCancellation(input.trackers, views, launchPatches, outcome);
  const date = input.reportDate || input.report?.report_date || "";
  const launchedAtPatches = launchPatches
    .filter((item) => item.status === "abort")
    .map((item) => ({
      launch_id: item.id,
      launched_at: combineDateAndTime(date, item.launch_time) ?? metadata.cancelled_at,
    }));

  return {
    outcome,
    metadata,
    shouldSubmitReport: true,
    releaseCrews: false,
    launchPatches,
    trackers,
    launchedAtPatches,
  };
}

export function canShowCancelAction(entity: {
  archived_at: string | null;
  cancellation?: CancellationMetadata | null;
  reported_at?: string | null;
  confirmed_at?: string | null;
}): boolean {
  if (entity.archived_at !== null) {
    return false;
  }
  if (entity.cancellation) {
    return false;
  }
  if (entity.confirmed_at) {
    return false;
  }
  return true;
}
