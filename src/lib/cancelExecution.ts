import { handleMissionCancellation } from "@/lib/missionCancellation";
import { toReportDate } from "@/lib/reportFormat";
import { notifyCrossTab } from "@/services/crossTabSync";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useReportStore } from "@/store/useReportStore";
import { useTaskStore } from "@/store/useTaskStore";
import { useTrackerStore } from "@/store/useTrackerStore";
import type { CancellationInitiatorRole, CancellationMetadata } from "@/types/cancellation";
import type { Task } from "@/types/mission";

export type { CancellationInitiatorRole };

function applyLaunchPatches(
  patches: Array<{ id: string; status: "abort" | "keep"; launch_time: string }>,
  launchedAtPatches: Array<{ launch_id: string; launched_at: string }>,
  reportId: string | null,
) {
  const launchStore = useLaunchStore.getState();
  patches.forEach((patch) => {
    if (patch.status !== "abort") {
      return;
    }
    const patched = launchStore.patchLaunchFromReport(patch.id, { launch_status_id: "abort" });
    if (!patched) {
      launchStore.updateLaunch(patch.id, { launch_status_id: "abort" });
    }
  });
  if (!reportId) {
    return;
  }
  const reportStore = useReportStore.getState();
  launchedAtPatches.forEach((item) => {
    reportStore.setLaunchLink(reportId, item.launch_id, { launched_at: item.launched_at });
  });
}

function stampTasks(taskIds: string[], metadata: CancellationMetadata) {
  const now = metadata.cancelled_at;
  const idSet = new Set(taskIds);
  useTaskStore.setState((state) => ({
    tasks: state.tasks.map((task) =>
      idSet.has(task.id)
        ? {
            ...task,
            cancellation: metadata,
            updated_at: now,
          }
        : task,
    ),
  }));
  notifyCrossTab("SYNC_TASKS");
}

function stampMission(missionId: string | null | undefined, metadata: CancellationMetadata) {
  if (!missionId) {
    return;
  }
  const now = metadata.cancelled_at;
  useMissionStore.setState((state) => ({
    missions: state.missions.map((mission) =>
      mission.id === missionId
        ? {
            ...mission,
            cancellation: metadata,
            updated_at: now,
          }
        : mission,
    ),
  }));
  notifyCrossTab("SYNC_MISSIONS");
}

function reportForTasks(tasks: Task[]) {
  const reports = useReportStore.getState().reports;
  return tasks
    .map((task) => {
      const day = task.scheduled_at ? toReportDate(task.scheduled_at) : "";
      return reports.find(
        (report) =>
          report.organization_id === task.organization_id &&
          report.report_date === day &&
          report.archived_at === null,
      );
    })
    .find(Boolean);
}

function runForTasks(
  tasks: Task[],
  input: { cancelTime: string; reason: string; role: CancellationInitiatorRole },
) {
  if (tasks.length === 0) {
    return null;
  }
  const taskIds = tasks.map((task) => task.id);
  const launches = useLaunchStore
    .getState()
    .launches.filter((launch) => taskIds.includes(launch.task_id) && launch.archived_at === null);
  const report = reportForTasks(tasks) ?? null;
  const links = report?.launches_by_trajectory ?? [];
  const result = handleMissionCancellation({
    report,
    launches,
    links,
    trackers: useTrackerStore.getState().trackers,
    cancelTime: input.cancelTime,
    reason: input.reason,
    role: input.role,
    reportDate: report?.report_date ?? (tasks[0]?.scheduled_at ? toReportDate(tasks[0].scheduled_at) : ""),
  });

  useTrackerStore.setState({ trackers: result.trackers });

  // Plan (allocations, battle groups, aiming points) stays intact.
  // Global tracker pool is released by applyTrackerCancellation; crews become free for
  // other tasks via releasedTaskIdsFromCancellation + occupiedCrewIds.
  if (result.outcome !== "cancelled_before_exit") {
    applyLaunchPatches(result.launchPatches, result.launchedAtPatches, report?.id ?? null);
  }

  stampTasks(taskIds, result.metadata);
  const missionIds = [...new Set(tasks.map((task) => task.mission_id).filter(Boolean))] as string[];
  missionIds.forEach((missionId) => stampMission(missionId, result.metadata));
  return result;
}

export function cancelTaskExecution(
  taskId: string,
  input: { cancelTime: string; reason: string; role: CancellationInitiatorRole },
) {
  const task = useTaskStore.getState().tasks.find((item) => item.id === taskId);
  if (!task) {
    return null;
  }
  return runForTasks([task], input);
}

export function cancelMissionExecution(
  missionId: string,
  input: { cancelTime: string; reason: string; role: CancellationInitiatorRole },
) {
  const mission = useMissionStore.getState().missions.find((item) => item.id === missionId);
  if (!mission) {
    return null;
  }
  const tasks = useTaskStore
    .getState()
    .tasks.filter(
      (task) =>
        (task.mission_id === missionId || mission.task_ids.includes(task.id)) &&
        task.archived_at === null &&
        !task.cancellation,
    );
  const result = runForTasks(tasks, input);
  if (result) {
    stampMission(missionId, result.metadata);
  }
  return result;
}

export function cancelReportDayExecution(
  reportId: string,
  input: { cancelTime: string; reason: string; role: CancellationInitiatorRole },
) {
  const report = useReportStore.getState().reports.find((item) => item.id === reportId);
  if (!report) {
    return null;
  }
  const tasks = useTaskStore.getState().tasks.filter(
    (task) =>
      task.organization_id === report.organization_id &&
      task.archived_at === null &&
      !task.cancellation &&
      task.scheduled_at &&
      toReportDate(task.scheduled_at) === report.report_date,
  );
  return runForTasks(tasks, input);
}
