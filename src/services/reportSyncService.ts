import { mockPlanningService, type StoredCheckpointReport, type StoredLaunchReport } from "@/services/planningRepository";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useReportStore } from "@/store/useReportStore";
import type { Launch } from "@/types/launch";
import type { LaunchTrajectoryLink, Report } from "@/types/report";

const REPORTED_BY_ROLE = "DETACHMENT";
const SOURCE_CHANNEL = "MANUAL";

export interface LaunchReportHistoryEntry {
  status: string;
  time: string | null;
  reason: string;
  updated_by: typeof REPORTED_BY_ROLE;
}

export interface LaunchReportPayload {
  launch_id: string;
  task_id: string;
  battle_group_id: string;
  status: string | null;
  actual_launch_time: string | null;
  comments: string;
  reported_by_role: typeof REPORTED_BY_ROLE;
  source_channel: typeof SOURCE_CHANNEL;
  reported_at: string;
  history: LaunchReportHistoryEntry[];
}

export interface CheckpointDraftInput {
  task_id: string;
  battle_group_id: string;
  checkpoint_id: string;
  code: string;
  title: string;
  status: string | null;
  fixed_time: string;
  comments: string;
}

export interface ReportSyncResult {
  ok: boolean;
  message?: string;
}

const REPORTED_LAUNCH_STATUS_IDS = new Set(["success", "abort", "problem", "other"]);

function reportedLaunchStatus(launchStatusId: string): string | null {
  return REPORTED_LAUNCH_STATUS_IDS.has(launchStatusId) ? launchStatusId : null;
}

function launchPayload(
  report: Report,
  link: LaunchTrajectoryLink,
  launch: Launch | undefined,
  reportedAt: string,
  previous: { status: string | null; history: LaunchReportHistoryEntry[] } | undefined,
): LaunchReportPayload {
  const trajectory = report.trajectories.find((item) => item.id === link.trajectory_id);
  const status = reportedLaunchStatus(launch?.launch_status_id ?? "");
  const actualLaunchTime = launch?.actual_launch_time || link.launched_at || null;
  const comments = launch?.comments ?? "";
  const entry: LaunchReportHistoryEntry = {
    status: status ?? "",
    time: actualLaunchTime,
    reason: comments,
    updated_by: REPORTED_BY_ROLE,
  };
  const history =
    status === null
      ? (previous?.history ?? [])
      : !previous || previous.status !== status
        ? [...(previous?.history ?? []), entry]
        : previous.history;
  return {
    launch_id: link.launch_id,
    task_id: launch?.task_id ?? "",
    battle_group_id: launch?.battle_group_id || trajectory?.battle_group_id || "",
    status,
    actual_launch_time: actualLaunchTime,
    comments,
    reported_by_role: REPORTED_BY_ROLE,
    source_channel: SOURCE_CHANNEL,
    reported_at: reportedAt,
    history,
  };
}

function fail(message: string): ReportSyncResult {
  console.error("Не вдалося зберегти звіт загону локально:", message);
  return { ok: false, message };
}

export async function submitDetachmentReport(
  reportId: string,
  checkpoints: CheckpointDraftInput[] = [],
): Promise<ReportSyncResult> {
  const report = useReportStore.getState().reports.find((item) => item.id === reportId);
  if (!report) {
    return fail("Звіт не знадено.");
  }
  const reportedAt = new Date().toISOString();
  const launches = useLaunchStore.getState().launches;
  const launchById = new Map(launches.map((launch) => [launch.id, launch]));
  const links = report.launches_by_trajectory;
  try {
    const previousRows = await mockPlanningService.listLaunchReports();
    const previousByLaunch = new Map(
      previousRows.map((row) => [
        row.launch_id,
        {
          status: row.status,
          history: row.history.map(
            (entry): LaunchReportHistoryEntry => ({
              status: entry.status,
              time: entry.time,
              reason: entry.reason,
              updated_by: REPORTED_BY_ROLE,
            }),
          ),
        },
      ]),
    );
    const launchRows: StoredLaunchReport[] = links.map((link) =>
      launchPayload(report, link, launchById.get(link.launch_id), reportedAt, previousByLaunch.get(link.launch_id)),
    );
    if (launchRows.length > 0) {
      await mockPlanningService.saveLaunchReports(launchRows);
    }
    const checkpointRows: StoredCheckpointReport[] = checkpoints.map((row) => {
      const timed = row.fixed_time.trim() !== "";
      return {
        task_id: row.task_id,
        battle_group_id: row.battle_group_id,
        checkpoint_id: row.checkpoint_id,
        code: row.code || row.checkpoint_id,
        title: row.title,
        status: timed ? "COMPLETED" : null,
        fixed_time: timed ? row.fixed_time : null,
        comments: row.comments,
        reported_at: reportedAt,
      };
    });
    if (checkpointRows.length > 0) {
      await mockPlanningService.saveCheckpointReports(checkpointRows);
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Локальне сховище недоступне.";
    return fail(message);
  }
}
