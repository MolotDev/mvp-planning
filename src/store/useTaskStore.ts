import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createMissionSeed } from "@/data/missionSeed";
import { isDateInRange } from "@/lib/dates";
import { getEntityState } from "@/lib/entityState";
import { cascadeMissionAllocation, type AllocationPair } from "@/lib/missionCascade";
import { useAssetStore } from "@/store/useAssetStore";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useTargetStore } from "@/store/useTargetStore";
import type { Target } from "@/types/target";
import type { Mission, MissionMetrics, MissionStatusFilter, Task, UavAsset } from "@/types/mission";

export const TASK_STORE_KEY = "military_crm_task_store";

type StoredTask = Task & {
  aiming_point_ids?: string[];
  assets?: UavAsset[];
};

export type TaskDraft = Omit<
  Task,
  "id" | "label" | "created_at" | "updated_at" | "archived_at" | "reported_at" | "mission_id"
> & { id?: string };

export interface TaskStoreState {
  tasks: Task[];
  taskSeq: number;
  createTasksForMission: (missionId: string, drafts: TaskDraft[]) => Task[];
  syncTasksForMission: (missionId: string, drafts: TaskDraft[]) => Task[];
  archiveTasksForMission: (missionId: string, archivedAt: string) => void;
  archiveTask: (id: string) => void;
  restoreTask: (id: string) => void;
  markTasksReported: (ids: string[], reportedAt: string) => void;
}

export function normalizeTask(task: StoredTask): Task {
  const legacyAssets = Array.isArray(task.assets) ? task.assets : [];
  const legacyPoints = Array.isArray(task.aiming_point_ids) ? task.aiming_point_ids : [];
  const aimingPointId =
    task.aiming_point_id !== undefined
      ? task.aiming_point_id || null
      : legacyPoints.length === 1
        ? legacyPoints[0]
        : null;
  return {
    id: task.id,
    label: task.label,
    mission_id: task.mission_id,
    target_ids: Array.isArray(task.target_ids) ? [...task.target_ids] : [],
    aiming_point_id: aimingPointId,
    organization_id: task.organization_id ?? "",
    asset_id: task.asset_id || legacyAssets[0]?.asset_id || "",
    quantity: typeof task.quantity === "number" ? task.quantity : (legacyAssets[0]?.quantity ?? 0),
    battle_groups_ids: Array.isArray(task.battle_groups_ids) ? [...task.battle_groups_ids] : [],
    created_at: task.created_at,
    updated_at: task.updated_at,
    reported_at: task.reported_at ?? null,
    archived_at: task.archived_at ?? null,
  };
}

function cloneSeed(): { tasks: Task[]; taskSeq: number } {
  const { tasks } = createMissionSeed();
  return {
    tasks: tasks.map((task) => normalizeTask(task)),
    taskSeq: tasks.length,
  };
}

function createId(): string {
  return crypto.randomUUID();
}

function cascadeBattleGroups(taskIds: string[], archivedAt: string) {
  useBattleGroupStore.getState().archiveForTasks(taskIds, archivedAt);
}

export function getTaskMetrics(tasks: Task[]): MissionMetrics {
  return {
    total: tasks.length,
    active: tasks.filter((task) => getEntityState(task) === "active").length,
    reported: tasks.filter((task) => getEntityState(task) === "reported").length,
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
  const mission = missions.find((item) => item.id === task.mission_id);
  if ((mission?.name ?? "").toLowerCase().includes(q) || mission?.label.toLowerCase().includes(q)) {
    return true;
  }
  return targets
    .filter((target) => task.target_ids.includes(target.id))
    .some(
      (target) =>
        target.name.toLowerCase().includes(q) ||
        // target.displayed_id.toLowerCase().includes(q) ||
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
    if (missionId && task.mission_id !== missionId) {
      return false;
    }
    if (targetId && !(task.target_ids ?? []).includes(targetId)) {
      return false;
    }
    if (organizationId && task.organization_id !== organizationId) {
      return false;
    }
    if (status !== "all" && getEntityState(task) !== status) {
      return false;
    }
    const mission = missions.find((item) => item.id === task.mission_id);
    const scheduledAt = mission?.scheduled_at ?? task.created_at;
    if (!isDateInRange(scheduledAt, from, to)) {
      return false;
    }
    return taskMatchesQuery(task, missions, targets, query);
  });
}

export const useTaskStore = create<TaskStoreState>()(
  persist(
    (set, get) => ({
      ...cloneSeed(),
      createTasksForMission: (missionId, drafts) => {
        const now = new Date().toISOString();
        let seq = get().taskSeq;
        const created = drafts.map((draft) => {
          seq += 1;
          const task: Task = {
            id: createId(),
            label: `TK-${seq}`,
            mission_id: missionId,
            target_ids: [...(draft.target_ids ?? [])],
            aiming_point_id: draft.aiming_point_id || null,
            organization_id: draft.organization_id,
            asset_id: draft.asset_id,
            quantity: draft.quantity,
            battle_groups_ids: [...(draft.battle_groups_ids ?? [])],
            created_at: now,
            updated_at: now,
            reported_at: null,
            archived_at: null,
          };
          return normalizeTask(task);
        });
        set((state) => ({
          tasks: [...state.tasks, ...created],
          taskSeq: seq,
        }));
        return created;
      },
      syncTasksForMission: (missionId, drafts) => {
        const now = new Date().toISOString();
        const unmatched = get()
          .tasks.filter((task) => task.mission_id === missionId && task.archived_at === null)
          .map((task) => normalizeTask(task));
        const kept: Task[] = [];
        const pairs: AllocationPair[] = [];
        const take = (existing: Task, draft: TaskDraft) => {
          const after: Task = {
            ...existing,
            target_ids: [...(draft.target_ids ?? [])],
            aiming_point_id: draft.aiming_point_id || null,
            organization_id: draft.organization_id,
            asset_id: draft.asset_id,
            quantity: draft.quantity,
            updated_at: now,
          };
          kept.push(after);
          pairs.push({ before: existing, after });
        };
        const toCreate: TaskDraft[] = [];
        drafts.forEach((draft) => {
          const index = draft.id ? unmatched.findIndex((task) => task.id === draft.id) : -1;
          if (index === -1) {
            toCreate.push(draft);
            return;
          }
          const [existing] = unmatched.splice(index, 1);
          take(existing, draft);
        });
        const archivedIds = unmatched.map((task) => task.id);
        set((state) => ({
          tasks: state.tasks.map((task) => {
            const updated = kept.find((item) => item.id === task.id);
            if (updated) {
              return updated;
            }
            if (archivedIds.includes(task.id)) {
              return { ...task, archived_at: now, updated_at: now };
            }
            return task;
          }),
        }));
        if (archivedIds.length > 0) {
          cascadeBattleGroups(archivedIds, now);
        }
        const created = toCreate.length > 0 ? get().createTasksForMission(missionId, toCreate) : [];
        const { targets, aimingPoints } = useTargetStore.getState();
        const cascaded = cascadeMissionAllocation({
          pairs,
          archivedTaskIds: archivedIds,
          now,
          launches: useLaunchStore.getState().launches,
          groups: useBattleGroupStore.getState().battleGroups,
          targets,
          aimingPoints,
          assets: useAssetStore.getState().assets,
        });
        useLaunchStore.setState({ launches: cascaded.launches });
        useBattleGroupStore.setState({ battleGroups: cascaded.groups });
        return [...kept, ...created];
      },
      archiveTasksForMission: (missionId, archivedAt) => {
        const ids = get()
          .tasks.filter((task) => task.mission_id === missionId)
          .map((task) => task.id);
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.mission_id === missionId
              ? { ...task, archived_at: archivedAt, updated_at: archivedAt }
              : task,
          ),
        }));
        cascadeBattleGroups(ids, archivedAt);
      },
      archiveTask: (id) => {
        const archivedAt = new Date().toISOString();
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, archived_at: archivedAt, updated_at: archivedAt } : task,
          ),
        }));
        cascadeBattleGroups([id], archivedAt);
      },
      restoreTask: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, archived_at: null, updated_at: now } : task,
          ),
        }));
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
        const tasks = persisted?.tasks ?? currentState.tasks;
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
  useTaskStore.setState(cloneSeed());
}
