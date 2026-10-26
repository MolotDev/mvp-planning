import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DICTIONARY } from "@/constants/dictionary";
import { CREWS } from "@/data/crews";
import { occupiedCrewIds, taskAllocation, taskIdsOnOperationalDay, validateBattleGroupInput, type BattleGroupRules } from "@/lib/battleGroup";
import type { CrewAssignmentDraft } from "@/lib/crewAllocation";
import { isApplyingRemoteSync, notifyCrossTab } from "@/services/crossTabSync";
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
  saveCrewDistribution: (taskId: string, drafts: CrewAssignmentDraft[]) => string | null;
}

function emptyBattleGroups(): { battleGroups: BattleGroup[] } {
  return { battleGroups: [] };
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
      ...emptyBattleGroups(),
      createBattleGroup: (input) => {
        const task = useTaskStore.getState().tasks.find((item) => item.id === input.task_id);
        const assets = task ? taskAllocation(task) : [];
        const soleAssetId = assets.length === 1 ? assets[0].asset_id : "";
        const scoped = soleAssetId ? { ...input, asset_id: soleAssetId } : input;
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
          allocation_line_id: null,
          uav_quantity: scoped.uav_quantity,
          created_at: now,
          updated_at: now,
          archived_at: null,
        };
        set((state) => ({ battleGroups: [group, ...state.battleGroups] }));
        linkTaskBattleGroup(scoped.task_id, group.id, now);
        syncLaunches([group.id]);
        syncReportForTask(scoped.task_id);
        notifyCrossTab("SYNC_TASKS", "SYNC_LAUNCHES");
        return group;
      },
      updateBattleGroup: (id, input) => {
        const existing = get().battleGroups.find((group) => group.id === id);
        if (!existing) {
          return null;
        }
        const task = useTaskStore.getState().tasks.find((item) => item.id === input.task_id);
        const assets = task ? taskAllocation(task) : [];
        const soleAssetId = assets.length === 1 ? assets[0].asset_id : "";
        const scoped = soleAssetId ? { ...input, asset_id: soleAssetId } : input;
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
          allocation_line_id: existing.allocation_line_id ?? null,
          uav_quantity: scoped.uav_quantity,
          updated_at: now,
        };
        set((state) => ({
          battleGroups: state.battleGroups.map((group) => (group.id === id ? updated : group)),
        }));
        syncLaunches([id]);
        syncReportForTask(scoped.task_id);
        notifyCrossTab("SYNC_TASKS", "SYNC_LAUNCHES");
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
        notifyCrossTab("SYNC_TASKS", "SYNC_LAUNCHES");
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
      saveCrewDistribution: (taskId, drafts) => {
        const task = useTaskStore.getState().tasks.find((item) => item.id === taskId);
        if (!task) {
          return DICTIONARY.tasks.not_found;
        }
        const assetByCrew = new Map<string, string>();
        for (const draft of drafts) {
          const allocation = task.allocations.find((line) => line.id === draft.allocationId);
          if (!allocation || draft.quantity < 1) {
            return DICTIONARY.tasks.crew_allocation.over_allocated;
          }
          const previous = assetByCrew.get(draft.crewId);
          if (previous && previous !== allocation.asset_id) {
            return DICTIONARY.tasks.validation.crew_busy;
          }
          assetByCrew.set(draft.crewId, allocation.asset_id);
        }
        for (const line of task.allocations) {
          const assigned = drafts
            .filter((draft) => draft.allocationId === line.id)
            .reduce((sum, draft) => sum + draft.quantity, 0);
          if (assigned > line.quantity) {
            return DICTIONARY.tasks.crew_allocation.over_allocated;
          }
        }
        const sameDay = taskIdsOnOperationalDay(taskId, useTaskStore.getState().tasks, useMissionStore.getState().missions);
        const occupied = occupiedCrewIds(
          get().battleGroups.filter((group) => group.task_id !== taskId),
          undefined,
          sameDay,
        );
        if (drafts.some((draft) => occupied.has(draft.crewId))) {
          return DICTIONARY.tasks.validation.crew_busy;
        }
        const now = new Date().toISOString();
        const existing = get().battleGroups.filter((group) => group.task_id === taskId && group.archived_at === null);
        const matchedIds = new Set<string>();
        const nextGroups = drafts.map((draft) => {
          const allocation = task.allocations.find((line) => line.id === draft.allocationId);
          const assetId = allocation?.asset_id ?? "";
          const match = existing.find(
            (group) =>
              !matchedIds.has(group.id) &&
              group.lead_crew_id === draft.crewId &&
              (group.allocation_line_id === draft.allocationId ||
                (group.allocation_line_id === null && group.asset_id === assetId)),
          );
          if (match) {
            matchedIds.add(match.id);
            return {
              ...match,
              asset_id: assetId,
              allocation_line_id: draft.allocationId,
              support_crew_ids: [],
              uav_quantity: draft.quantity,
              updated_at: now,
            };
          }
          return {
            id: createId(),
            task_id: taskId,
            lead_crew_id: draft.crewId,
            support_crew_ids: [],
            asset_id: assetId,
            allocation_line_id: draft.allocationId,
            uav_quantity: draft.quantity,
            created_at: now,
            updated_at: now,
            archived_at: null,
          };
        });
        const nextIds = new Set(nextGroups.map((group) => group.id));
        const removedIds = new Set(existing.filter((group) => !matchedIds.has(group.id)).map((group) => group.id));
        set((state) => ({
          battleGroups: [
            ...nextGroups,
            ...state.battleGroups
              .filter((group) => !nextIds.has(group.id))
              .map((group) =>
                removedIds.has(group.id) ? { ...group, archived_at: now, updated_at: now } : group,
              ),
          ],
        }));
        const activeIds = nextGroups.map((group) => group.id);
        useTaskStore.setState((state) => ({
          tasks: state.tasks.map((item) =>
            item.id === taskId
              ? {
                  ...item,
                  battle_groups_ids: [...new Set([...item.battle_groups_ids, ...activeIds])],
                  updated_at: now,
                }
              : item,
          ),
        }));
        syncLaunches([...activeIds, ...removedIds]);
        syncReportForTask(taskId);
        notifyCrossTab("SYNC_TASKS", "SYNC_LAUNCHES");
        return null;
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
          return { ...currentState, battleGroups: [] };
        }
        return {
          ...currentState,
          battleGroups: groups.map((group) => {
            const legacy = group as BattleGroup & { uav_model_id?: string };
            return {
              ...group,
              asset_id: group.asset_id || legacy.uav_model_id || "",
              allocation_line_id: group.allocation_line_id ?? null,
              support_crew_ids: [...group.support_crew_ids],
            };
          }),
        };
      },
      onRehydrateStorage: () => () => {
        queueMicrotask(() => {
          if (isApplyingRemoteSync()) {
            return;
          }
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
  useBattleGroupStore.setState(emptyBattleGroups());
}
