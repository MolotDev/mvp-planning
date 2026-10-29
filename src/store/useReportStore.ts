import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CHECKPOINTS } from "@/data/checkpoints";
import {
  aggregateDay,
  blankTrajectory,
  mergeLaunchLinks,
  sameLaunchLinks,
  sameTrajectories,
  syncTrajectoriesFromLaunches,
  trajectoryPresets,
  type PlanningSnapshot,
} from "@/lib/reportAggregation";
import { isReportEditable } from "@/lib/missionConfirmation";
import { combineDateAndTime, DEFAULT_LAUNCH_TIME, toReportDate } from "@/lib/reportFormat";
import { isReportSubmittable } from "@/lib/reportValidation";
import { formatIsoDate } from "@/lib/dates";
import {
  registerReportReconcile,
  registerReportReopen,
  registerReportSource,
  registerReportSync,
} from "@/store/storeBridge";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useTargetStore } from "@/store/useTargetStore";
import { useTaskStore } from "@/store/useTaskStore";
import type {
  ActualEvent,
  CheckpointUpdate,
  LaunchTrajectoryLink,
  Report,
  Trajectory,
} from "@/types/report";

export const REPORT_STORE_KEY = "military_crm_report_store";

export interface ManualReportResult {
  report: Report;
  created: boolean;
}

export interface ReportStoreState {
  reports: Report[];
  ensureForTask: (taskId: string) => Report | null;
  createManual: (organizationId: string, reportDate: string) => ManualReportResult | null;
  syncDraftLinks: (id: string) => void;
  updateReport: (id: string, patch: ReportPatch) => Report | null;
  updateTrajectory: (id: string, trajectoryId: string, patch: TrajectoryPatch) => void;
  addTrajectoryColumn: (id: string, tableId: string) => void;
  addTrajectoryTable: (id: string) => void;
  removeTrajectory: (reportId: string, trajectoryId: string) => void;
  removeEvent: (reportId: string, evantId: string) => void;
  addEvent: (id: string, description?: string) => void;
  updateEvent: (id: string, index: number, patch: Partial<ActualEvent>) => void;
  setLaunchLink: (id: string, launchId: string, patch: Partial<LaunchTrajectoryLink>) => void;
  addImages: (id: string, images: string[]) => void;
  removeImage: (id: string, index: number) => void;
  clearReport: (id: string) => void;
  submitReport: (id: string) => boolean;
  reopenForMission: (organizationIds: string[], reportDate: string) => void;
  archiveReport: (id: string) => boolean;
}

type ReportPatch = Partial<
  Pick<
    Report,
    | "analysis_timestamp"
    | "commander_summary"
    | "planning_participants"
    | "adjacent_units_participants"
  >
>;

type TrajectoryPatch = Partial<
  Pick<
    Trajectory,
    | "name"
    | "battle_group_id"
    | "asset_id"
    | "distance"
    | "trajectory_height"
    | "height_above_hot_point"
    | "hot_point_cross_line"
    | "duration"
    | "time_on_target"
  >
>;

function planningSnapshot(): PlanningSnapshot {
  return {
    missions: useMissionStore.getState().missions,
    tasks: useTaskStore.getState().tasks,
    targets: useTargetStore.getState().targets,
    battleGroups: useBattleGroupStore.getState().battleGroups,
    launches: useLaunchStore.getState().launches,
  };
}

function createId(): string {
  return crypto.randomUUID();
}

function canEditReportContent(report: Report): boolean {
  return isReportEditable(report, useMissionStore.getState().missions, useTaskStore.getState().tasks);
}

function findActiveReport(reports: Report[], organizationId: string, reportDate: string): Report | undefined {
  return reports.find(
    (report) =>
      report.organization_id === organizationId &&
      report.report_date === reportDate &&
      report.archived_at === null &&
      report.status !== "archived",
  );
}

function withLinks(report: Report, now: string): Report {
  const slice = aggregateDay(report.organization_id, report.report_date, planningSnapshot());
  const trajectories = syncTrajectoriesFromLaunches(report.trajectories, slice.launches, now);
  return {
    ...report,
    trajectories,
    launches_by_trajectory: mergeLaunchLinks({ ...report, trajectories }, slice.launches, now),
  };
}

function createDraft(organizationId: string, reportDate: string): Report {
  const now = new Date().toISOString();
  const slice = aggregateDay(organizationId, reportDate, planningSnapshot());
  const tableId = createId();
  const trajectory = blankTrajectory(tableId, now, trajectoryPresets(slice));
  const draft: Report = {
    id: createId(),
    organization_id: organizationId,
    report_date: reportDate,
    analysis_timestamp: now,
    status: "draft",
    commander_summary: null,
    planning_participants: null,
    adjacent_units_participants: null,
    trajectories: [trajectory],
    launches_by_trajectory: [],
    checkpoint_updates: [],
    actual_events: [],
    images: [],
    created_at: now,
    updated_at: now,
    archived_at: null,
    submitted_at: null,
  };
  return withLinks(draft, now);
}

function normalizeReport(report: Report): Report {
  const trajectories = Array.isArray(report.trajectories) ? report.trajectories : [];
  return {
    ...report,
    commander_summary: report.commander_summary ?? null,
    planning_participants: report.planning_participants ?? null,
    adjacent_units_participants: report.adjacent_units_participants ?? null,
    trajectories: trajectories.map((trajectory) => ({
      ...trajectory,
      table_id: trajectory.table_id || createId(),
      battle_group_id: trajectory.battle_group_id ?? "",
      asset_id: trajectory.asset_id ?? "",
      distance: Number(trajectory.distance) || 0,
      archived_at: trajectory.archived_at ?? null,
    })),
    launches_by_trajectory: Array.isArray(report.launches_by_trajectory)
      ? report.launches_by_trajectory.map((link) => ({
          launch_id: link.launch_id,
          trajectory_id: link.trajectory_id ?? "",
          launch_number: Number(link.launch_number) || 0,
          launched_at: link.launched_at ?? "",
        }))
      : [],
    checkpoint_updates: Array.isArray(report.checkpoint_updates) ? report.checkpoint_updates.map((item) => ({ ...item })) : [],
    actual_events: Array.isArray(report.actual_events)
      ? report.actual_events.map((item) => ({ ...item, comment: item.comment ?? "" }))
      : [],
    images: Array.isArray(report.images) ? [...report.images] : [],
    archived_at: report.archived_at ?? null,
    submitted_at: report.submitted_at ?? null,
  };
}

function replaceReport(reports: Report[], next: Report): Report[] {
  return reports.map((report) => (report.id === next.id ? next : report));
}

function missionsReadyToClose(missionIds: string[]): string[] {
  const tasks = useTaskStore.getState().tasks;
  return missionIds.filter((missionId) => {
    const related = tasks.filter(
      (task) => task.archived_at === null && task.allocations.some((line) => line.mission_id === missionId),
    );
    return related.length > 0 && related.every((task) => task.reported_at !== null);
  });
}

export const useReportStore = create<ReportStoreState>()(
  persist(
    (set, get) => ({
      reports: [],
      ensureForTask: (taskId) => {
        const task = useTaskStore.getState().tasks.find((item) => item.id === taskId);
        if (!task || task.archived_at !== null || !task.organization_id) {
          return null;
        }
        const hasGroup = useBattleGroupStore
          .getState()
          .battleGroups.some((group) => group.task_id === taskId && group.archived_at === null);
        if (!hasGroup) {
          return null;
        }
        if (!task.scheduled_at) {
          return null;
        }
        const activeMission = task.allocations.some((line) => {
          const mission = useMissionStore.getState().missions.find((item) => item.id === line.mission_id);
          return mission != null && mission.archived_at === null;
        });
        if (!activeMission) {
          return null;
        }
        const reportDate = toReportDate(task.scheduled_at);
        const existing = findActiveReport(get().reports, task.organization_id, reportDate);
        if (existing) {
          if (canEditReportContent(existing)) {
            get().syncDraftLinks(existing.id);
          }
          return get().reports.find((report) => report.id === existing.id) ?? existing;
        }
        const created = createDraft(task.organization_id, reportDate);
        set((state) => ({ reports: [created, ...state.reports] }));
        return created;
      },
      createManual: (organizationId, reportDate) => {
        const organization = organizationId.trim();
        if (!organization || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
          return null;
        }
        const existing = findActiveReport(get().reports, organization, reportDate);
        if (existing) {
          if (canEditReportContent(existing)) {
            get().syncDraftLinks(existing.id);
          }
          const report = get().reports.find((item) => item.id === existing.id) ?? existing;
          return { report, created: false };
        }
        const created = createDraft(organization, reportDate);
        set((state) => ({ reports: [created, ...state.reports] }));
        return { report: created, created: true };
      },
      syncDraftLinks: (id) => {
        const current = get().reports.find((report) => report.id === id);
        if (!current || !canEditReportContent(current)) {
          return;
        }
        const now = new Date().toISOString();
        const next = withLinks(current, now);
        if (
          sameLaunchLinks(current.launches_by_trajectory, next.launches_by_trajectory) &&
          sameTrajectories(current.trajectories, next.trajectories)
        ) {
          return;
        }
        set((state) => ({
          reports: replaceReport(state.reports, { ...next, updated_at: now }),
        }));
      },
      updateReport: (id, patch) => {
        const current = get().reports.find((report) => report.id === id);
        if (!current || !canEditReportContent(current)) {
          return null;
        }
        const now = new Date().toISOString();
        const updated: Report = { ...current, ...patch, updated_at: now };
        set((state) => ({ reports: replaceReport(state.reports, updated) }));
        return updated;
      },
      updateTrajectory: (id, trajectoryId, patch) => {
        const current = get().reports.find((report) => report.id === id);
        if (!current || !canEditReportContent(current)) {
          return;
        }
        const now = new Date().toISOString();
        const updated: Report = {
          ...current,
          updated_at: now,
          trajectories: current.trajectories.map((trajectory) =>
            trajectory.id === trajectoryId ? { ...trajectory, ...patch, updated_at: now } : trajectory,
          ),
        };
        set((state) => ({ reports: replaceReport(state.reports, updated) }));
      },
      addTrajectoryColumn: (id, tableId) => {
        const current = get().reports.find((report) => report.id === id);
        if (!current || !canEditReportContent(current) || !tableId) {
          return;
        }
        const now = new Date().toISOString();
        const slice = aggregateDay(current.organization_id, current.report_date, planningSnapshot());
        const trajectory = blankTrajectory(tableId, now, trajectoryPresets(slice));
        trajectory.name = `${current.trajectories.length + 1}`;
        const draft: Report = {
          ...current,
          trajectories: [...current.trajectories, trajectory],
          updated_at: now,
        };
        set((state) => ({ reports: replaceReport(state.reports, withLinks(draft, now)) }));
      },
      addTrajectoryTable: (id) => {
        get().addTrajectoryColumn(id, createId());
      },
      removeTrajectory: (reportId, trajectoryId) => {
        const current = get().reports.find((report) => report.id === reportId);
        if (!current || !canEditReportContent(current)) {
          return;
        }
        const now = new Date().toISOString();
        const draft: Report = {
          ...current,
          trajectories: current.trajectories.filter((trajectory) =>  trajectory.id !== trajectoryId),
          updated_at: now,
        };
        set((state) => ({ reports: replaceReport(state.reports, withLinks(draft, now)) }));
      },
      removeEvent: (reportId, eventId) => {
        const current = get().reports.find((report) => report.id === reportId);
        if (!current || !canEditReportContent(current)) {
          return;
        }
        const now = new Date().toISOString();
        const draft: Report = {
          ...current,
          actual_events: current.actual_events.filter((event) => event.id !== eventId),
          updated_at: now,
        };
        set((state) => ({ reports: replaceReport(state.reports, withLinks(draft, now)) }));
      },
      addEvent: (id, description = "") => {
        const current = get().reports.find((report) => report.id === id);
        if (!current || !canEditReportContent(current)) {
          return;
        }
        const nowDate = new Date();
        const now = nowDate.toISOString();
        const slice = aggregateDay(current.organization_id, current.report_date, planningSnapshot());
        const group = slice.battleGroups[0];
        const checkpoint = CHECKPOINTS[0];
        const comment = 
          current.checkpoint_updates.find((item) => item.battle_group_id === group?.id)?.comment ?? "";
        const event: ActualEvent = {
          id: createId(),
          time: DEFAULT_LAUNCH_TIME,
          date: current.report_date || formatIsoDate(nowDate),
          event_description: description,
          comment: "",
        };
        const checkpointUpdate: CheckpointUpdate | null =
          group && checkpoint
            ? {
                battle_group_id: group.id,
                checkpoint_id: checkpoint.id,
                updated_at: now,
                comment,
              }
            : null;
        set((state) => ({
          reports: replaceReport(state.reports, {
            ...current,
            actual_events: [...current.actual_events, event],
            checkpoint_updates: checkpointUpdate
              ? [...current.checkpoint_updates, checkpointUpdate]
              : current.checkpoint_updates,
            updated_at: now,
          }),
        }));
      },
      updateEvent: (id, index, patch) => {
        const current = get().reports.find((report) => report.id === id);
        if (!current || !canEditReportContent(current) || !current.actual_events[index]) {
          return;
        }
        const now = new Date().toISOString();
        set((state) => ({
          reports: replaceReport(state.reports, {
            ...current,
            actual_events: current.actual_events.map((event, eventIndex) =>
              eventIndex === index ? { ...event, ...patch } : event,
            ),
            updated_at: now,
          }),
        }));
      },
      setLaunchLink: (id, launchId, patch) => {
        const current = get().reports.find((report) => report.id === id);
        if (!current || !canEditReportContent(current)) {
          return;
        }
        const now = new Date().toISOString();
        const existing = current.launches_by_trajectory.find((link) => link.launch_id === launchId);
        const defaultLaunchedAt =
          combineDateAndTime(current.report_date, DEFAULT_LAUNCH_TIME) ?? now;
        const nextLink: LaunchTrajectoryLink = {
          launch_id: launchId,
          trajectory_id: existing?.trajectory_id ?? "",
          launch_number: existing?.launch_number ?? 0,
          launched_at: existing?.launched_at || defaultLaunchedAt,
          ...patch,
        };
        const links = existing
          ? current.launches_by_trajectory.map((link) => (link.launch_id === launchId ? nextLink : link))
          : [...current.launches_by_trajectory, nextLink];
        set((state) => ({
          reports: replaceReport(state.reports, {
            ...current,
            launches_by_trajectory: links,
            updated_at: now,
          }),
        }));
      },
      addImages: (id, images) => {
        const current = get().reports.find((report) => report.id === id);
        if (!current || !canEditReportContent(current) || images.length === 0) {
          return;
        }
        const now = new Date().toISOString();
        set((state) => ({
          reports: replaceReport(state.reports, {
            ...current,
            images: [...current.images, ...images],
            updated_at: now,
          }),
        }));
      },
      removeImage: (id, index) => {
        const current = get().reports.find((report) => report.id === id);
        if (!current || !canEditReportContent(current)) {
          return;
        }
        const now = new Date().toISOString();
        set((state) => ({
          reports: replaceReport(state.reports, {
            ...current,
            images: current.images.filter((_, imageIndex) => imageIndex !== index),
            updated_at: now,
          }),
        }));
      },
      clearReport: (id) => {
        const current = get().reports.find((report) => report.id === id);
        if (!current || !canEditReportContent(current)) {
          return;
        }
        const now = new Date().toISOString();
        const slice = aggregateDay(current.organization_id, current.report_date, planningSnapshot());
        useLaunchStore.getState().resetLaunchesForReportClear(slice.launches.map((launch) => launch.id));
        const tableId = createId();
        const trajectory = blankTrajectory(tableId, now, trajectoryPresets(slice));
        const cleared: Report = {
          ...current,
          status: "draft",
          submitted_at: null,
          analysis_timestamp: "",
          commander_summary: null,
          planning_participants: null,
          adjacent_units_participants: null,
          trajectories: [trajectory],
          launches_by_trajectory: [],
          checkpoint_updates: [],
          actual_events: [],
          images: [],
          updated_at: now,
        };
        set((state) => ({ reports: replaceReport(state.reports, withLinks(cleared, now)) }));
      },
      reopenForMission: (organizationIds, reportDate) => {
        const orgs = new Set(organizationIds.filter(Boolean));
        if (orgs.size === 0 || !reportDate) {
          return;
        }
        const now = new Date().toISOString();
        set((state) => ({
          reports: state.reports.map((report) => {
            if (
              report.archived_at !== null ||
              report.status === "archived" ||
              report.status !== "submitted" ||
              report.report_date !== reportDate ||
              !orgs.has(report.organization_id)
            ) {
              return report;
            }
            return {
              ...report,
              status: "draft",
              updated_at: now,
            };
          }),
        }));
      },
      submitReport: (id) => {
        const current = get().reports.find((report) => report.id === id);
        if (!current || !canEditReportContent(current) || !isReportSubmittable(current, planningSnapshot())) {
          return false;
        }
        const now = new Date().toISOString();
        const slice = aggregateDay(current.organization_id, current.report_date, planningSnapshot());
        useTaskStore.getState().markTasksReported(
          slice.tasks.map((task) => task.id),
          now,
        );
        useLaunchStore.getState().markLaunchesReported(
          slice.launches.map((launch) => launch.id),
          now,
        );
        const missionIds = missionsReadyToClose([
          ...new Set(slice.tasks.flatMap((task) => task.allocations.map((line) => line.mission_id))),
        ]);
        if (missionIds.length > 0) {
          useMissionStore.getState().markMissionsReported(missionIds, now);
        }
        set((state) => ({
          reports: replaceReport(state.reports, {
            ...current,
            status: "submitted",
            submitted_at: now,
            updated_at: now,
          }),
        }));
        return true;
      },
      archiveReport: (id) => {
        const current = get().reports.find((report) => report.id === id);
        if (!current || current.archived_at !== null) {
          return false;
        }
        const now = new Date().toISOString();
        set((state) => ({
          reports: replaceReport(state.reports, {
            ...current,
            status: "archived",
            archived_at: now,
            updated_at: now,
          }),
        }));
        return true;
      },
    }),
    {
      name: REPORT_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ reports: state.reports }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { reports?: Report[] } | undefined;
        const reports = persisted?.reports;
        if (!Array.isArray(reports)) {
          return { ...currentState, reports: [] };
        }
        return {
          ...currentState,
          reports: reports.map((report) => normalizeReport(report)),
        };
      },
      onRehydrateStorage: () => () => {
        queueMicrotask(() => {
          reconcileAllocatedReports();
        });
      },
    },
  ),
);

registerReportSource(() => useReportStore.getState().reports);

registerReportReopen((organizationIds, reportDate) => {
  useReportStore.getState().reopenForMission(organizationIds, reportDate);
});

export function reconcileAllocatedReports() {
  const taskIds = [
    ...new Set(
      useBattleGroupStore
        .getState()
        .battleGroups.filter((group) => group.archived_at === null)
        .map((group) => group.task_id),
    ),
  ];
  taskIds.forEach((taskId) => {
    useReportStore.getState().ensureForTask(taskId);
  });
}

registerReportSync((taskId) => {
  useReportStore.getState().ensureForTask(taskId);
});

registerReportReconcile(() => {
  reconcileAllocatedReports();
});

export function resetReportStore() {
  useReportStore.persist.clearStorage();
  useReportStore.setState({ reports: [] });
}
