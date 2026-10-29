import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DICTIONARY } from "@/constants/dictionary";
import { operationalDay } from "@/lib/battleGroup";
import { allocationsFromBlocks, isPlanReady, type PlanTargetBlock } from "@/lib/detachmentPlan";
import { isBeforeToday, isDateInRange, startOfDay } from "@/lib/dates";
import { getEntityState, matchesEntityStatusFilter } from "@/lib/entityState";
import { COMPLETED_CONFIRMED } from "@/types/target";
import { cascadeMissionAllocation } from "@/lib/missionCascade";
import { notifyCrossTab } from "@/services/crossTabSync";
import { taskMissionIds, taskTargetIds } from "@/lib/taskAllocations";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { missionScheduledAt } from "@/store/storeBridge";
import { useTargetStore } from "@/store/useTargetStore";
import type { Target } from "@/types/target";
import type { Mission, MissionMetrics, MissionStatusFilter, Task, TaskAllocation, UavAsset } from "@/types/mission";

export const TASK_STORE_KEY = "military_crm_task_store";

type StoredTask = Partial<Task> & {
  id: string;
  label: string;
  organization_id?: string;
  created_at: string;
  updated_at: string;
  mission_id?: string | null;
  target_ids?: string[];
  aiming_point_id?: string | null;
  aiming_point_ids?: string[];
  asset_id?: string;
  quantity?: number;
  assets?: UavAsset[];
  allocations?: TaskAllocation[];
};

export interface TaskDraft {
  id?: string;
  organization_id: string;
  target_id: string;
  aiming_point_id: string | null;
  asset_id: string;
  quantity: number;
}

export interface TaskStoreState {
  tasks: Task[];
  taskSeq: number;
  createTasksForMission: (missionId: string, scheduledAt: string, drafts: TaskDraft[]) => Task[];
  syncTasksForMission: (missionId: string, scheduledAt: string, drafts: TaskDraft[]) => Task[];
  archiveTasksForMission: (missionId: string, archivedAt: string) => void;
  archiveTask: (id: string) => void;
  restoreTask: (id: string) => void;
  markTasksReported: (ids: string[], reportedAt: string) => void;
  setTasksConfirmed: (ids: string[], confirmedAt: string | null) => void;
  createDetachmentTask: (input: { missionId: string; organizationId: string; scheduledAt: string }) => Task | null;
  saveDetachmentPlan: (taskId: string, plan: PlanTargetBlock[]) => string | null;
}

function scheduledDayIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return startOfDay(date).toISOString();
}

function legacyAllocations(task: StoredTask): TaskAllocation[] {
  const legacyAssets = Array.isArray(task.assets) ? task.assets : [];
  const legacyPoints = Array.isArray(task.aiming_point_ids) ? task.aiming_point_ids : [];
  const aimingPointId =
    task.aiming_point_id !== undefined
      ? task.aiming_point_id || null
      : legacyPoints.length === 1
        ? legacyPoints[0]
        : null;
  const assetId = task.asset_id || legacyAssets[0]?.asset_id || "";
  const quantity = typeof task.quantity === "number" ? task.quantity : (legacyAssets[0]?.quantity ?? 0);
  const targetId = task.target_ids?.[0] ?? "";
  if (!task.mission_id && !assetId && !targetId) {
    return [];
  }
  return [
    {
      id: `${task.id}:line`,
      mission_id: task.mission_id ?? "",
      target_id: targetId,
      aiming_point_id: aimingPointId,
      asset_id: assetId,
      quantity,
    },
  ];
}

export function normalizeTask(task: StoredTask): Task {
  const stored = Array.isArray(task.allocations) ? task.allocations : [];
  const allocations = (stored.length > 0 ? stored : legacyAllocations(task)).map((line) => ({
    id: line.id,
    mission_id: line.mission_id ?? "",
    target_id: line.target_id ?? "",
    aiming_point_id: line.aiming_point_id || null,
    asset_id: line.asset_id ?? "",
    quantity: Number(line.quantity) || 0,
  }));
  const missionId = allocations[0]?.mission_id ?? task.mission_id ?? "";
  const fromMission = missionId ? missionScheduledAt(missionId) : null;
  const scheduledAt =
    task.scheduled_at ||
    fromMission ||
    (missionId ? "" : task.created_at ? scheduledDayIso(task.created_at) : "");
  return {
    id: task.id,
    label: task.label,
    organization_id: task.organization_id ?? "",
    mission_id: task.mission_id || allocations[0]?.mission_id || null,
    source: task.source === "detachment" ? "detachment" : "center",
    scheduled_at: scheduledAt ? scheduledDayIso(scheduledAt) : "",
    allocations,
    battle_groups_ids: Array.isArray(task.battle_groups_ids) ? [...task.battle_groups_ids] : [],
    fact_submitted_at: task.fact_submitted_at ?? null,
    fact_notes: task.fact_notes ?? null,
    created_at: task.created_at,
    updated_at: task.updated_at,
    reported_at: task.reported_at ?? null,
    confirmed_at: task.confirmed_at ?? null,
    archived_at: task.archived_at ?? null,
    cancellation: (task as Task).cancellation ?? null,
  };
}

function emptyTasks(): { tasks: Task[]; taskSeq: number } {
  return { tasks: [], taskSeq: 0 };
}

function createId(): string {
  return crypto.randomUUID();
}

function reuseAllocationId(
  beforeTasks: Task[],
  removedLineIds: Set<string>,
  consumedLineIds: Set<string>,
  organizationId: string,
  row: TaskDraft,
): string {
  if (row.id && removedLineIds.has(row.id) && !consumedLineIds.has(row.id)) {
    consumedLineIds.add(row.id);
    return row.id;
  }
  const candidates = beforeTasks.flatMap((task) =>
    task.organization_id === organizationId
      ? task.allocations.filter(
          (line) => removedLineIds.has(line.id) && !consumedLineIds.has(line.id) && line.asset_id === row.asset_id,
        )
      : [],
  );
  const continuation = candidates.find((line) => line.target_id === row.target_id) ?? candidates[0];
  if (continuation) {
    consumedLineIds.add(continuation.id);
    return continuation.id;
  }
  const created = createId();
  consumedLineIds.add(created);
  return created;
}

function cascadeBattleGroups(taskIds: string[], archivedAt: string) {
  useBattleGroupStore.getState().archiveForTasks(taskIds, archivedAt);
}

export function getTaskMetrics(tasks: Task[]): MissionMetrics {
  return {
    total: tasks.length,
    active: tasks.filter((task) => getEntityState(task) === "active").length,
    reported: tasks.filter((task) => {
      const state = getEntityState(task);
      return state === "reported" || state === COMPLETED_CONFIRMED;
    }).length,
    archived: tasks.filter((task) => getEntityState(task) === "archived").length,
  };
}

export function taskMatchesQuery(
  task: Task,
  missions: Mission[],
  targets: Target[],
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  const missionIds = new Set(taskMissionIds(task));
  if (
    missions.some(
      (mission) =>
        missionIds.has(mission.id) &&
        ((mission.name ?? "").toLowerCase().includes(q) || mission.label.toLowerCase().includes(q)),
    )
  ) {
    return true;
  }
  const targetIds = new Set(taskTargetIds(task));
  return targets
    .filter((target) => targetIds.has(target.id))
    .some(
      (target) =>
        target.name.toLowerCase().includes(q) ||
        target.displayed_id.toLowerCase().includes(q) ||
        target.label.toLowerCase().includes(q) ||
        target.mgrs.toLowerCase().includes(q),
    );
}

export function filterTasks(
  tasks: Task[],
  missions: Mission[],
  targets: Target[],
  query: string,
  status: MissionStatusFilter,
  from: Date | null,
  to: Date | null,
  targetId?: string | null,
  missionId?: string | null,
  organizationId?: string | null,
): Task[] {
  return tasks.filter((task) => {
    if (missionId && task.mission_id !== missionId && !task.allocations.some((line) => line.mission_id === missionId)) {
      return false;
    }
    if (targetId && !task.allocations.some((line) => line.target_id === targetId)) {
      return false;
    }
    if (organizationId && task.organization_id !== organizationId) {
      return false;
    }
    if (status !== "all" && !matchesEntityStatusFilter(task, status)) {
      return false;
    }
    if (!isDateInRange(task.scheduled_at || task.created_at, from, to)) {
      return false;
    }
    return taskMatchesQuery(task, missions, targets, query);
  });
}

export const useTaskStore = create<TaskStoreState>()(
  persist(
    (set, get) => ({
      ...emptyTasks(),
      createTasksForMission: (missionId, scheduledAt, drafts) => {
        return get().syncTasksForMission(missionId, scheduledAt, drafts);
      },
      syncTasksForMission: (missionId, scheduledAt, drafts) => {
        const now = new Date().toISOString();
        const day = operationalDay(scheduledAt);
        let seq = get().taskSeq;
        const beforeTasks = get().tasks.map((task) => ({
          ...task,
          allocations: task.allocations.map((line) => ({ ...line })),
          battle_groups_ids: [...task.battle_groups_ids],
        }));
        let tasks = beforeTasks.map((task) => ({
          ...task,
          allocations: task.allocations.map((line) => ({ ...line })),
          battle_groups_ids: [...task.battle_groups_ids],
        }));
        const removedLineIds = new Set<string>();
        const strippedTaskIds = new Set<string>();
        tasks = tasks.map((task) => {
          const removed = task.allocations.filter((line) => line.mission_id === missionId);
          if (removed.length === 0) {
            return task;
          }
          strippedTaskIds.add(task.id);
          removed.forEach((line) => removedLineIds.add(line.id));
          return {
            ...task,
            allocations: task.allocations.filter((line) => line.mission_id !== missionId),
            updated_at: now,
          };
        });
        const rows = drafts.filter((draft) => draft.organization_id && draft.asset_id && draft.quantity > 0);
        const consumedLineIds = new Set<string>();
        const byOrg = new Map<string, TaskDraft[]>();
        rows.forEach((draft) => {
          const list = byOrg.get(draft.organization_id) ?? [];
          list.push(draft);
          byOrg.set(draft.organization_id, list);
        });
        byOrg.forEach((orgRows, organizationId) => {
          let task = tasks.find(
            (item) =>
              item.archived_at === null &&
              item.organization_id === organizationId &&
              operationalDay(item.scheduled_at) === day,
          );
          if (!task) {
            seq += 1;
            task = {
              id: createId(),
              label: `TK-${seq}`,
              organization_id: organizationId,
              mission_id: missionId,
              source: "center",
              scheduled_at: scheduledDayIso(scheduledAt),
              allocations: [],
              battle_groups_ids: [],
              fact_submitted_at: null,
              fact_notes: null,
              created_at: now,
              updated_at: now,
              reported_at: null,
              confirmed_at: null,
              archived_at: null,
              cancellation: null,
            };
            tasks.push(task);
          }
          const lines: TaskAllocation[] = orgRows.map((row) => ({
            id: reuseAllocationId(beforeTasks, removedLineIds, consumedLineIds, organizationId, row),
            mission_id: missionId,
            target_id: row.target_id,
            aiming_point_id: row.aiming_point_id || null,
            asset_id: row.asset_id,
            quantity: row.quantity,
          }));
          const next: Task = {
            ...task,
            scheduled_at: scheduledDayIso(scheduledAt),
            allocations: [...task.allocations, ...lines],
            updated_at: now,
          };
          tasks = tasks.map((item) => (item.id === task.id ? next : item));
        });
        const archivedIds = tasks
          .filter((task) => strippedTaskIds.has(task.id) && task.archived_at === null && task.allocations.length === 0)
          .map((task) => task.id);
        const archived = new Set(archivedIds);
        tasks = tasks.map((task) =>
          archived.has(task.id) ? { ...task, archived_at: now, updated_at: now } : task,
        );
        const lineTaskId = new Map<string, string>();
        tasks.forEach((task) => {
          task.allocations.forEach((line) => lineTaskId.set(line.id, task.id));
        });
        set({ tasks, taskSeq: seq });
        if (archivedIds.length > 0) {
          cascadeBattleGroups(archivedIds, now);
        }
        useLaunchStore.setState({
          launches: useLaunchStore.getState().launches.map((launch) => {
            const nextTaskId = launch.allocation_line_id ? lineTaskId.get(launch.allocation_line_id) : undefined;
            if (nextTaskId && nextTaskId !== launch.task_id && launch.archived_at === null) {
              return { ...launch, task_id: nextTaskId, updated_at: now };
            }
            return launch;
          }),
        });
        const { targets, aimingPoints } = useTargetStore.getState();
        const cascaded = cascadeMissionAllocation({
          beforeTasks,
          afterTasks: tasks,
          archivedTaskIds: archivedIds,
          now,
          launches: useLaunchStore.getState().launches,
          groups: useBattleGroupStore.getState().battleGroups,
          targets,
          aimingPoints,
        });
        useLaunchStore.setState({ launches: cascaded.launches });
        useBattleGroupStore.setState({ battleGroups: cascaded.groups });
        notifyCrossTab("SYNC_TASKS", "SYNC_LAUNCHES");
        return tasks.filter(
          (task) => task.archived_at === null && task.allocations.some((line) => line.mission_id === missionId),
        );
      },
      archiveTasksForMission: (missionId, archivedAt) => {
        const droppedLineIds = new Set<string>();
        const emptied: string[] = [];
        set((state) => ({
          tasks: state.tasks.map((task) => {
            const removed = task.allocations.filter((line) => line.mission_id === missionId);
            if (removed.length === 0) {
              return task;
            }
            removed.forEach((line) => droppedLineIds.add(line.id));
            const allocations = task.allocations.filter((line) => line.mission_id !== missionId);
            if (allocations.length === 0) {
              emptied.push(task.id);
              return { ...task, allocations, archived_at: archivedAt, updated_at: archivedAt };
            }
            return { ...task, allocations, updated_at: archivedAt };
          }),
        }));
        if (emptied.length > 0) {
          cascadeBattleGroups(emptied, archivedAt);
        }
        if (droppedLineIds.size > 0) {
          useLaunchStore.setState({
            launches: useLaunchStore.getState().launches.map((launch) =>
              launch.allocation_line_id &&
              droppedLineIds.has(launch.allocation_line_id) &&
              launch.archived_at === null &&
              launch.reported_at === null
                ? { ...launch, archived_at: archivedAt, updated_at: archivedAt }
                : launch,
            ),
          });
        }
        notifyCrossTab("SYNC_TASKS", "SYNC_LAUNCHES");
      },
      archiveTask: (id) => {
        const archivedAt = new Date().toISOString();
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, archived_at: archivedAt, updated_at: archivedAt } : task,
          ),
        }));
        cascadeBattleGroups([id], archivedAt);
        notifyCrossTab("SYNC_TASKS", "SYNC_LAUNCHES");
      },
      restoreTask: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, archived_at: null, updated_at: now } : task,
          ),
        }));
        notifyCrossTab("SYNC_TASKS");
      },
      markTasksReported: (ids, reportedAt) => {
        const idSet = new Set(ids);
        set((state) => ({
          tasks: state.tasks.map((task) =>
            idSet.has(task.id) && task.archived_at === null && task.reported_at === null
              ? { ...task, reported_at: reportedAt, updated_at: reportedAt }
              : task,
          ),
        }));
        notifyCrossTab("SYNC_TASKS");
      },
      setTasksConfirmed: (ids, confirmedAt) => {
        const idSet = new Set(ids);
        const now = new Date().toISOString();
        set((state) => ({
          tasks: state.tasks.map((task) =>
            idSet.has(task.id) && task.archived_at === null
              ? { ...task, confirmed_at: confirmedAt, updated_at: now }
              : task,
          ),
        }));
        notifyCrossTab("SYNC_TASKS");
      },
      createDetachmentTask: ({ missionId, organizationId, scheduledAt }) => {
        if (!missionId || isBeforeToday(startOfDay(new Date(scheduledAt)))) {
          return null;
        }
        const now = new Date().toISOString();
        const seq = get().taskSeq + 1;
        const task: Task = {
          id: createId(),
          label: `TK-${seq}`,
          organization_id: organizationId,
          mission_id: missionId,
          source: "detachment",
          scheduled_at: scheduledDayIso(scheduledAt),
          allocations: [],
          battle_groups_ids: [],
          fact_submitted_at: null,
          fact_notes: null,
          created_at: now,
          updated_at: now,
          reported_at: null,
          confirmed_at: null,
          archived_at: null,
          cancellation: null,
        };
        set((state) => ({
          tasks: [task, ...state.tasks],
          taskSeq: seq,
        }));
        notifyCrossTab("SYNC_TASKS");
        return task;
      },
      saveDetachmentPlan: (taskId, plan) => {
        const task = get().tasks.find((item) => item.id === taskId);
        if (!task || task.source !== "detachment" || task.archived_at !== null || task.reported_at !== null) {
          return DICTIONARY.tasks.not_found;
        }
        const missionId = task.mission_id || task.allocations[0]?.mission_id || "";
        if (!missionId || !isPlanReady(plan)) {
          return DICTIONARY.targets_catalog.validation.required;
        }
        const catalog = useTargetStore.getState();
        const known = plan.every((block) =>
          catalog.targets.some((item) => item.id === block.targetId && item.archived_at === null),
        );
        if (!known) {
          return DICTIONARY.targets_catalog.validation.required;
        }
        const now = new Date().toISOString();
        const allocations = allocationsFromBlocks(plan, missionId);
        const beforeTasks = get().tasks.map((item) => ({
          ...item,
          allocations: item.allocations.map((line) => ({ ...line })),
          battle_groups_ids: [...item.battle_groups_ids],
        }));
        const afterTasks = beforeTasks.map((item) =>
          item.id === taskId ? { ...item, mission_id: missionId, allocations, updated_at: now } : item,
        );
        const cascaded = cascadeMissionAllocation({
          beforeTasks,
          afterTasks,
          archivedTaskIds: [],
          now,
          launches: useLaunchStore.getState().launches,
          groups: useBattleGroupStore.getState().battleGroups,
          targets: catalog.targets,
          aimingPoints: catalog.aimingPoints,
        });
        useLaunchStore.setState({ launches: cascaded.launches });
        useBattleGroupStore.setState({ battleGroups: cascaded.groups });
        set({ tasks: afterTasks });
        notifyCrossTab("SYNC_TASKS", "SYNC_LAUNCHES");
        return null;
      },
    }),
    {
      name: TASK_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tasks: state.tasks,
        taskSeq: state.taskSeq,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<Pick<TaskStoreState, "tasks" | "taskSeq">> | undefined;
        const tasks = persisted?.tasks ?? [];
        return {
          ...currentState,
          ...persisted,
          tasks: tasks.map((task) => normalizeTask(task)),
          taskSeq: persisted?.taskSeq ?? currentState.taskSeq,
        };
      },
    },
  ),
);

export function resetTaskStore() {
  useTaskStore.persist.clearStorage();
  useTaskStore.setState(emptyTasks());
}
