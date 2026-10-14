import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createMissionSeed } from "@/data/missionSeed";
import { allMissionReportsSubmitted, missionHasSubmittedReport } from "@/lib/missionConfirmation";
import { readAllocatedReports } from "@/store/storeBridge";
import { isDateInRange } from "@/lib/dates";
import { getEntityState } from "@/lib/entityState";
import type { TaskDraft } from "@/store/useTaskStore";
import { useTaskStore } from "@/store/useTaskStore";
import type { AimingPoint, Target } from "@/types/target";
import type { Mission, MissionMetrics, MissionStatusFilter, Task } from "@/types/mission";

export const MISSION_STORE_KEY = "military_crm_mission_store";

export interface MissionInput {
  name: string | null;
  scheduled_at: string;
  description: string;
}

export interface MissionStoreState {
  missions: Mission[];
  missionSeq: number;
  createMission: (input: MissionInput, taskDrafts: TaskDraft[]) => Mission;
  updateMission: (id: string, input: MissionInput, taskDrafts: TaskDraft[]) => Mission | null;
  archiveMission: (id: string) => void;
  restoreMission: (id: string) => void;
  markMissionsReported: (ids: string[], reportedAt: string) => void;
  confirmMission: (id: string) => boolean;
  unlockMissionReports: (id: string) => boolean;
}

function normalizeMission(mission: Mission): Mission {
  return {
    ...mission,
    task_ids: Array.isArray(mission.task_ids) ? [...mission.task_ids] : [],
    confirmed_at: mission.confirmed_at ?? null,
  };
}

function cloneSeed(): { missions: Mission[]; missionSeq: number } {
  const { missions } = createMissionSeed();
  return {
    missions: missions.map((mission) => normalizeMission(mission)),
    missionSeq: missions.length,
  };
}

function createId(): string {
  return crypto.randomUUID();
}

export function getMissionMetrics(missions: Mission[]): MissionMetrics {
  return {
    total: missions.length,
    active: missions.filter((mission) => getEntityState(mission) === "active").length,
    reported: missions.filter((mission) => getEntityState(mission) === "reported").length,
    archived: missions.filter((mission) => getEntityState(mission) === "archived").length,
  };
}

export function matchesMissionStatus(mission: Mission, status: MissionStatusFilter): boolean {
  if (status === "all") {
    return true;
  }
  return getEntityState(mission) === status;
}

export function missionMatchesQuery(
  mission: Mission,
  tasks: Task[],
  targets: Target[],
  aimingPoints: AimingPoint[],
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  if ((mission.name ?? "").toLowerCase().includes(q) || mission.label.toLowerCase().includes(q)) {
    return true;
  }
  const linkedTasks = tasks.filter((task) => mission.task_ids.includes(task.id));
  return linkedTasks.some((task) => {
    const taskTargets = targets.filter((target) => task.target_ids.includes(target.id));
    const taskPoints = aimingPoints.filter((point) => task.aiming_point_ids.includes(point.id));
    return (
      taskTargets.some(
        (target) =>
          target.name.toLowerCase().includes(q) ||
          // target.displayed_id.toLowerCase().includes(q) ||
          target.mgrs.toLowerCase().includes(q),
      ) ||
      taskPoints.some(
        (point) =>
          point.name.toLowerCase().includes(q) ||
          // point.displayed_id.toLowerCase().includes(q) ||
          point.mgrs.toLowerCase().includes(q),
      )
    );
  });
}

export function filterMissions(
  missions: Mission[],
  tasks: Task[],
  targets: Target[],
  aimingPoints: AimingPoint[],
  query: string,
  status: MissionStatusFilter,
  from: Date | null,
  to: Date | null,
): Mission[] {
  return missions.filter(
    (mission) =>
      matchesMissionStatus(mission, status) &&
      isDateInRange(mission.scheduled_at, from, to) &&
      missionMatchesQuery(mission, tasks, targets, aimingPoints, query),
  );
}

export const useMissionStore = create<MissionStoreState>()(
  persist(
    (set, get) => ({
      ...cloneSeed(),
      createMission: (input, taskDrafts) => {
        const now = new Date().toISOString();
        const id = createId();
        const createdTasks = useTaskStore.getState().createTasksForMission(id, taskDrafts);
        const mission: Mission = {
          id,
          label: `MN-${get().missionSeq + 1}`,
          name: input.name?.trim() ? input.name.trim() : null,
          scheduled_at: input.scheduled_at,
          description: input.description.trim(),
          task_ids: createdTasks.map((task) => task.id),
          created_at: now,
          updated_at: now,
          reported_at: null,
          confirmed_at: null,
          archived_at: null,
        };
        set((state) => ({
          missions: [mission, ...state.missions],
          missionSeq: state.missionSeq + 1,
        }));
        return mission;
      },
      updateMission: (id, input, taskDrafts) => {
        const existing = get().missions.find((mission) => mission.id === id);
        if (!existing || existing.archived_at !== null || existing.reported_at !== null || existing.confirmed_at !== null) {
          return null;
        }
        if (missionHasSubmittedReport(existing, useTaskStore.getState().tasks, readAllocatedReports())) {
          return null;
        }
        const now = new Date().toISOString();
        const syncedTasks = useTaskStore.getState().syncTasksForMission(id, taskDrafts);
        const updated: Mission = {
          ...existing,
          name: input.name?.trim() ? input.name.trim() : null,
          scheduled_at: input.scheduled_at,
          description: input.description.trim(),
          task_ids: syncedTasks.map((task) => task.id),
          updated_at: now,
        };
        set((state) => ({
          missions: state.missions.map((mission) => (mission.id === id ? updated : mission)),
        }));
        return updated;
      },
      archiveMission: (id) => {
        const archivedAt = new Date().toISOString();
        useTaskStore.getState().archiveTasksForMission(id, archivedAt);
        set((state) => ({
          missions: state.missions.map((mission) =>
            mission.id === id ? { ...mission, archived_at: archivedAt, updated_at: archivedAt } : mission,
          ),
        }));
      },
      restoreMission: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          missions: state.missions.map((mission) =>
            mission.id === id ? { ...mission, archived_at: null, updated_at: now } : mission,
          ),
        }));
      },
      markMissionsReported: (ids, reportedAt) => {
        const idSet = new Set(ids);
        set((state) => ({
          missions: state.missions.map((mission) =>
            idSet.has(mission.id) && mission.archived_at === null && mission.reported_at === null
              ? { ...mission, reported_at: reportedAt, updated_at: reportedAt }
              : mission,
          ),
        }));
      },
      confirmMission: (id) => {
        const mission = get().missions.find((item) => item.id === id);
        if (!mission || mission.archived_at !== null || mission.confirmed_at !== null) {
          return false;
        }
        if (!allMissionReportsSubmitted(mission, useTaskStore.getState().tasks, readAllocatedReports())) {
          return false;
        }
        const now = new Date().toISOString();
        set((state) => ({
          missions: state.missions.map((item) =>
            item.id === id ? { ...item, confirmed_at: now, updated_at: now } : item,
          ),
        }));
        return true;
      },
      unlockMissionReports: (id) => {
        const mission = get().missions.find((item) => item.id === id);
        if (!mission || mission.confirmed_at === null) {
          return false;
        }
        const now = new Date().toISOString();
        set((state) => ({
          missions: state.missions.map((item) =>
            item.id === id ? { ...item, confirmed_at: null, updated_at: now } : item,
          ),
        }));
        return true;
      },
    }),
    {
      name: MISSION_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        missions: state.missions,
        missionSeq: state.missionSeq,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as
          | Partial<Pick<MissionStoreState, "missions" | "missionSeq">>
          | undefined;
        const missions = persisted?.missions ?? currentState.missions;
        return {
          ...currentState,
          ...persisted,
          missions: missions.map((mission) => normalizeMission(mission)),
          missionSeq: persisted?.missionSeq ?? currentState.missionSeq,
        };
      },
    },
  ),
);

export function resetMissionStore() {
  useMissionStore.persist.clearStorage();
  useMissionStore.setState(cloneSeed());
}

