import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CREWS } from "@/data/crews";
import { createBattleGroupSeed } from "@/data/battleGroupSeed";
import { taskAllocation, taskIdsOnOperationalDay, validateBattleGroupInput, type BattleGroupRules } from "@/lib/battleGroup";
import { registerBattleGroupSource, syncAllocatedReports, syncLaunchForGroup, syncReportForTask, reconcileLaunchesWithBattleGroups } from "@/store/storeBridge";
import { useMissionStore } from "@/store/useMissionStore";
import { useTaskStore } from "@/store/useTaskStore";
import type { BattleGroup, BattleGroupInput } from "@/types/battleGroup";

export const BATTLE_GROUP_STORE_KEY = "military_crm_battle_group_store";

export interface BattleGroupStoreState {
  battleGroups: BattleGroup[];
  createBattleGroup: (input: BattleGroupInput) => BattleGroup | null;
  updateBattleGroup: (id: string, input: BattleGroupInput) => BattleGroup | null;
  archiveBattleGroup: (id: string) => boolean;
  archiveForTasks: (taskIds: string[], archivedAt: string) => void;
}

function cloneSeed(): { battleGroups: BattleGroup[] } {
  return {
    battleGroups: createBattleGroupSeed().map((group) => ({
      ...group,
      support_crew_ids: [...group.support_crew_ids],
    })),
  };
}

function createId(): string {
  return crypto.randomUUID();
}

function syncLaunches(groupIds: string[]) {
  const groups = useBattleGroupStore
    .getState()
    .battleGroups.filter((group) => groupIds.includes(group.id));
  groups.forEach((group) => {
    syncLaunchForGroup(group);
  });
}

function validationRules(taskId: string, exceptGroupId?: string): BattleGroupRules {
  const tasks = useTaskStore.getState().tasks;
  const task = tasks.find((item) => item.id === taskId);
  return {
    exceptGroupId,
    taskAssets: task ? taskAllocation(task) : [],
    sameDayTaskIds: taskIdsOnOperationalDay(taskId, tasks, useMissionStore.getState().missions),
  };
}

function linkTaskBattleGroup(taskId: string, groupId: string, now: string) {
  useTaskStore.setState((state) => ({
    tasks: state.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            battle_groups_ids: task.battle_groups_ids.includes(groupId)
              ? task.battle_groups_ids
              : [...task.battle_groups_ids, groupId],
            updated_at: now,
          }
        : task,
    ),
  }));
}

export const useBattleGroupStore = create<BattleGroupStoreState>()(
  persist(
    (set, get) => ({
      ...cloneSeed(),
      createBattleGroup: (input) => {
        const task = useTaskStore.getState().tasks.find((item) => item.id === input.task_id);
        const scoped = task?.asset_id ? { ...input, asset_id: task.asset_id } : input;
        const error = validateBattleGroupInput(scoped, get().battleGroups, validationRules(scoped.task_id));
        if (error) {
          return null;
        }
        const now = new Date().toISOString();
        const group: BattleGroup = {
          id: createId(),
          task_id: input.task_id,
          lead_crew_id: input.lead_crew_id,
          support_crew_ids: [...input.support_crew_ids],
          asset_id: scoped.asset_id,
          uav_quantity: scoped.uav_quantity,
          created_at: now,
          updated_at: now,
          archived_at: null,
        };
        set((state) => ({ battleGroups: [group, ...state.battleGroups] }));
        linkTaskBattleGroup(scoped.task_id, group.id, now);
        syncLaunches([group.id]);
        syncReportForTask(scoped.task_id);
        return group;
      },
      updateBattleGroup: (id, input) => {
        const existing = get().battleGroups.find((group) => group.id === id);
        if (!existing) {
          return null;
        }
        const task = useTaskStore.getState().tasks.find((item) => item.id === input.task_id);
        const scoped = task?.asset_id ? { ...input, asset_id: task.asset_id } : input;
        const error = validateBattleGroupInput(scoped, get().battleGroups, validationRules(scoped.task_id, id));
        if (error) {
          return null;
        }
        const now = new Date().toISOString();
        const updated: BattleGroup = {
          ...existing,
          lead_crew_id: scoped.lead_crew_id,
          support_crew_ids: [...scoped.support_crew_ids],
          asset_id: scoped.asset_id,
          uav_quantity: scoped.uav_quantity,
          updated_at: now,
        };
        set((state) => ({
          battleGroups: state.battleGroups.map((group) => (group.id === id ? updated : group)),
        }));
        syncLaunches([id]);
        syncReportForTask(scoped.task_id);
        return updated;
      },
      archiveBattleGroup: (id) => {
        const existing = get().battleGroups.find((group) => group.id === id);
        if (!existing || existing.archived_at !== null) {
          return false;
        }
        const archivedAt = new Date().toISOString();
        set((state) => ({
          battleGroups: state.battleGroups.map((group) =>
            group.id === id ? { ...group, archived_at: archivedAt, updated_at: archivedAt } : group,
          ),
        }));
        syncLaunches([id]);
        return true;
      },
      archiveForTasks: (taskIds, archivedAt) => {
        const ids = new Set(taskIds);
        set((state) => ({
          battleGroups: state.battleGroups.map((group) =>
            ids.has(group.task_id)
              ? { ...group, archived_at: archivedAt, updated_at: archivedAt }
              : group,
          ),
        }));
        syncLaunches(
          get().battleGroups.filter((group) => ids.has(group.task_id)).map((group) => group.id),
        );
      },
    }),
    {
      name: BATTLE_GROUP_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        battleGroups: state.battleGroups,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { battleGroups?: BattleGroup[] } | undefined;
        const groups = persisted?.battleGroups;
        const knownCrews = new Set(CREWS.map((crew) => crew.id));
        const compatible =
          Array.isArray(groups) &&
          groups.every(
            (group) =>
              knownCrews.has(group.lead_crew_id) &&
              group.support_crew_ids.every((id) => knownCrews.has(id)),
          );
        if (!compatible) {
          return { ...currentState, ...cloneSeed() };
        }
        return {
          ...currentState,
          battleGroups: groups.map((group) => {
            const legacy = group as BattleGroup & { uav_model_id?: string };
            return {
              ...group,
              asset_id: group.asset_id || legacy.uav_model_id || "",
              support_crew_ids: [...group.support_crew_ids],
            };
          }),
        };
      },
      onRehydrateStorage: () => () => {
        queueMicrotask(() => {
          reconcileLaunchesWithBattleGroups();
          syncAllocatedReports();
        });
      },
    },
  ),
);

registerBattleGroupSource(() => useBattleGroupStore.getState().battleGroups);

export function resetBattleGroupStore() {
  useBattleGroupStore.persist.clearStorage();
  useBattleGroupStore.setState(cloneSeed());
}
