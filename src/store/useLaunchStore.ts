import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { PLANNED_LAUNCH_STATUS_ID, TRACKERS } from "@/data/launchCatalog";
import { createLaunchSeed } from "@/data/launchSeed";
import { formatTimeUk } from "@/lib/dates";
import { resolveDefaultAimingMgrs } from "@/lib/launchAiming";
import { isLaunchReadOnly, isLaunchReportStatus, syncLaunchesWithGroup, withProcessedAt } from "@/lib/launches";
import { reconcileLaunchesWithBattleGroups, registerLaunchSync } from "@/store/storeBridge";
import { useMissionStore } from "@/store/useMissionStore";
import { useTargetStore } from "@/store/useTargetStore";
import { useTaskStore } from "@/store/useTaskStore";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch, LaunchReportInput } from "@/types/launch";

export type LaunchFieldPatch = Partial<
  Pick<
    Launch,
    | "aiming_point_mgrs"
    | "trajectory_name"
    | "asset_serial_number"
    | "tracker_model_id"
    | "tracker_model_serial_number"
    | "ammo_model_id"
    | "ammo_quantity"
    | "launch_status_id"
    | "cause_launch_problem_id"
    | "comments"
  >
>;

export const LAUNCH_STORE_KEY = "military_crm_launch_store";

export interface LaunchStoreState {
  launches: Launch[];
  syncBattleGroup: (group: BattleGroup) => void;
  reconcile: (groups: BattleGroup[]) => void;
  updateLaunch: (id: string, patch: LaunchFieldPatch) => Launch | null;
  patchLaunchFromReport: (id: string, patch: LaunchFieldPatch) => Launch | null;
  clearLaunchTracker: (id: string) => Launch | null;
  clearLaunchTrackerFromReport: (id: string) => Launch | null;
  restoreLaunch: (snapshot: Launch) => void;
  reportLaunch: (id: string, input: LaunchReportInput) => Launch | null;
  archiveLaunch: (id: string) => Launch | null;
  markLaunchesReported: (ids: string[], reportedAt: string) => void;
  resetLaunchesForReportClear: (ids: string[]) => void;
}

function launchMission(launch: Launch) {
  const task = useTaskStore.getState().tasks.find((item) => item.id === launch.task_id) ?? null;
  const mission = task
    ? (useMissionStore.getState().missions.find((item) => item.id === task.mission_id) ?? null)
    : null;
  return { task, mission };
}

function isStoredLaunchLocked(launch: Launch): boolean {
  const { task, mission } = launchMission(launch);
  return isLaunchReadOnly(launch, task, mission);
}

function isReportLaunchBlocked(launch: Launch): boolean {
  if (launch.archived_at !== null) {
    return true;
  }
  return launchMission(launch).mission?.confirmed_at != null;
}

function commitLaunchPatch(
  set: (partial: (state: { launches: Launch[] }) => { launches: Launch[] }) => void,
  existing: Launch,
  patch: LaunchFieldPatch,
): Launch {
  const tracker = resolveTrackerFields(existing, patch);
  const now = new Date().toISOString();
  const updated = withProcessedAt(
    {
      ...existing,
      ...patch,
      tracker_model_id: tracker.tracker_model_id,
      tracker_model_serial_number: tracker.tracker_model_serial_number,
      updated_at: now,
    },
    now,
  );
  set((state) => ({
    launches: state.launches.map((launch) => (launch.id === existing.id ? updated : launch)),
  }));
  return updated;
}

function resolveTrackerFields(
  existing: Launch,
  patch: LaunchFieldPatch,
): { tracker_model_id: string | null; tracker_model_serial_number: string | null } {
  const serialTouched = Object.prototype.hasOwnProperty.call(patch, "tracker_model_serial_number");
  const modelTouched = Object.prototype.hasOwnProperty.call(patch, "tracker_model_id");
  if (!serialTouched && !modelTouched) {
    return {
      tracker_model_id: existing.tracker_model_id,
      tracker_model_serial_number: existing.tracker_model_serial_number,
    };
  }
  const serial = serialTouched ? patch.tracker_model_serial_number : existing.tracker_model_serial_number;
  const cleared =
    patch.tracker_model_id === null || serial === null || serial === undefined || serial.trim() === "";
  if (cleared && (serialTouched || patch.tracker_model_id === null)) {
    return { tracker_model_id: null, tracker_model_serial_number: null };
  }
  const nextSerial = serial ?? "";
  const nextModel =
    nextSerial.trim() && TRACKERS.length === 1
      ? TRACKERS[0].id
      : modelTouched
        ? (patch.tracker_model_id ?? null)
        : existing.tracker_model_id;
  return {
    tracker_model_id: nextModel,
    tracker_model_serial_number: nextSerial,
  };
}

function cloneSeed(): { launches: Launch[] } {
  return {
    launches: createLaunchSeed().map((launch) => ({ ...launch })),
  };
}

export const useLaunchStore = create<LaunchStoreState>()(
  persist(
    (set, get) => ({
      ...cloneSeed(),
      syncBattleGroup: (group) => {
        const task = useTaskStore.getState().tasks.find((item) => item.id === group.task_id);
        const { aimingPoints, targets } = useTargetStore.getState();
        const defaultMgrs = resolveDefaultAimingMgrs(task, aimingPoints, targets);
        set((state) => ({
          launches: syncLaunchesWithGroup(state.launches, group, { defaultMgrs }),
        }));
      },
      updateLaunch: (id, patch) => {
        const existing = get().launches.find((launch) => launch.id === id);
        if (!existing || isStoredLaunchLocked(existing)) {
          return null;
        }
        return commitLaunchPatch(set, existing, patch);
      },
      patchLaunchFromReport: (id, patch) => {
        const existing = get().launches.find((launch) => launch.id === id);
        if (!existing || isReportLaunchBlocked(existing)) {
          return null;
        }
        return commitLaunchPatch(set, existing, patch);
      },
      clearLaunchTrackerFromReport: (id) => {
        const existing = get().launches.find((launch) => launch.id === id);
        if (!existing || isReportLaunchBlocked(existing)) {
          return null;
        }
        if (existing.tracker_model_id === null && existing.tracker_model_serial_number === null) {
          return existing;
        }
        return get().patchLaunchFromReport(id, {
          tracker_model_id: null,
          tracker_model_serial_number: null,
        });
      },
      clearLaunchTracker: (id) => {
        const existing = get().launches.find((launch) => launch.id === id);
        if (!existing || isStoredLaunchLocked(existing)) {
          return null;
        }
        if (existing.tracker_model_id === null && existing.tracker_model_serial_number === null) {
          return existing;
        }
        return get().updateLaunch(id, {
          tracker_model_id: null,
          tracker_model_serial_number: null,
        });
      },
      restoreLaunch: (snapshot) => {
        const existing = get().launches.find((launch) => launch.id === snapshot.id);
        if (!existing || isStoredLaunchLocked(existing)) {
          return;
        }
        set((state) => ({
          launches: state.launches.map((launch) => (launch.id === snapshot.id ? { ...snapshot } : launch)),
        }));
      },
      reconcile: (groups) => {
        groups.forEach((group) => {
          get().syncBattleGroup(group);
        });
      },
      archiveLaunch: (id) => {
        const existing = get().launches.find((launch) => launch.id === id);
        if (!existing || existing.archived_at !== null) {
          return null;
        }
        const now = new Date().toISOString();
        const updated = { ...existing, archived_at: now, updated_at: now };
        set((state) => ({
          launches: state.launches.map((launch) => (launch.id === id ? updated : launch)),
        }));
        return updated;
      },
      resetLaunchesForReportClear: (ids) => {
        const idSet = new Set(ids);
        if (idSet.size === 0) {
          return;
        }
        const now = new Date().toISOString();
        set((state) => ({
          launches: state.launches.map((launch) => {
            if (!idSet.has(launch.id) || launch.archived_at !== null || isReportLaunchBlocked(launch)) {
              return launch;
            }
            if (
              launch.launch_status_id === PLANNED_LAUNCH_STATUS_ID &&
              launch.cause_launch_problem_id === "" &&
              launch.comments === "" &&
              launch.reported_at === null &&
              launch.reported_at_time === null
            ) {
              return launch;
            }
            return {
              ...launch,
              launch_status_id: PLANNED_LAUNCH_STATUS_ID,
              cause_launch_problem_id: "",
              comments: "",
              reported_at: null,
              reported_at_time: null,
              updated_at: now,
            };
          }),
        }));
      },
      markLaunchesReported: (ids, reportedAt) => {
        const idSet = new Set(ids);
        set((state) => ({
          launches: state.launches.map((launch) =>
            idSet.has(launch.id) && launch.archived_at === null && launch.reported_at === null
              ? {
                  ...launch,
                  reported_at: reportedAt,
                  reported_at_time: formatTimeUk(reportedAt),
                  updated_at: reportedAt,
                }
              : launch,
          ),
        }));
      },
      reportLaunch: (id, input) => {
        const existing = get().launches.find((launch) => launch.id === id);
        if (!existing || isStoredLaunchLocked(existing)) {
          return null;
        }
        if (!isLaunchReportStatus(input.launch_status_id)) {
          return null;
        }
        const now = new Date().toISOString();
        const updated = withProcessedAt(
          {
            ...existing,
            asset_serial_number: input.asset_serial_number.trim(),
            tracker_model_id: input.tracker_model_id,
            tracker_model_serial_number: input.tracker_model_serial_number.trim(),
            aiming_point_mgrs: input.aiming_point_mgrs.trim(),
            ammo_model_id: input.ammo_model_id,
            ammo_quantity: input.ammo_quantity,
            launch_status_id: input.launch_status_id,
            cause_launch_problem_id:
              input.launch_status_id === "problem" ? input.cause_launch_problem_id : "",
            comments: input.comments.trim(),
            reported_at: now,
            reported_at_time: formatTimeUk(now),
            updated_at: now,
          },
          now,
        );
        set((state) => ({
          launches: state.launches.map((launch) => (launch.id === id ? updated : launch)),
        }));
        return updated;
      },
    }),
    {
      name: LAUNCH_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ launches: state.launches }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { launches?: Launch[] } | undefined;
        const launches = persisted?.launches;
        if (!Array.isArray(launches)) {
          return { ...currentState, ...cloneSeed() };
        }
        return {
          ...currentState,
          launches: launches.map((launch) => {
            const legacy = launch as Launch & {
              uav_model_id?: string;
              uav_model_serial_number?: string;
            };
            return withProcessedAt(
              {
                ...launch,
                asset_id: launch.asset_id || legacy.uav_model_id || "",
                asset_serial_number: launch.asset_serial_number || legacy.uav_model_serial_number || "",
                trajectory_name: launch.trajectory_name?.trim() ? launch.trajectory_name.trim() : null,
                processed_at: launch.processed_at ?? null,
              },
              launch.updated_at,
            );
          }),
        };
      },
      onRehydrateStorage: () => () => {
        queueMicrotask(() => {
          reconcileLaunchesWithBattleGroups();
        });
      },
    },
  ),
);

registerLaunchSync((group) => {
  useLaunchStore.getState().syncBattleGroup(group);
});

export function resetLaunchStore() {
  useLaunchStore.persist.clearStorage();
  useLaunchStore.setState(cloneSeed());
}
