import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  createInitialTrackersPool,
  findTrackerByRef,
  normalizeTrackersPool,
  trackerOptionsForLaunch,
} from "@/lib/trackerPool";
import { TRACKER_STORE_KEY, type Tracker } from "@/types/tracker";

export interface TrackerAssignmentContext {
  launchId: string;
  assetId?: string | null;
  taskId?: string | null;
  missionId?: string | null;
}

interface TrackerStoreState {
  trackers: Tracker[];
  optionsForLaunch: (currentSerial?: string | null) => Tracker[];
  findByRef: (ref?: string | null) => Tracker | undefined;
  assign: (trackerRef: string, context: TrackerAssignmentContext) => Tracker | null;
  release: (trackerRef: string) => Tracker | null;
  releaseByLaunch: (launchId: string) => void;
  releaseAllForTask: (taskId: string) => void;
  releaseAllForMission: (missionId: string) => void;
  markExpended: (trackerRefs: string[]) => void;
  syncLaunchAssignment: (
    launchId: string,
    previousSerial: string | null | undefined,
    nextSerial: string | null | undefined,
    context: Omit<TrackerAssignmentContext, "launchId">,
  ) => void;
}

function releaseTracker(trackers: Tracker[], trackerRef: string): Tracker[] {
  const found = findTrackerByRef(trackers, trackerRef);
  if (!found || found.status === "expended") {
    return trackers;
  }
  return trackers.map((item) =>
    item.id === found.id
      ? {
          ...item,
          status: "available",
          assigned_mission_id: null,
          assigned_task_id: null,
          assigned_launch_id: null,
          assigned_asset_id: null,
        }
      : item,
  );
}

export const useTrackerStore = create<TrackerStoreState>()(
  persist(
    (set, get) => ({
      trackers: createInitialTrackersPool(),
      optionsForLaunch: (currentSerial) => trackerOptionsForLaunch(get().trackers, currentSerial),
      findByRef: (ref) => findTrackerByRef(get().trackers, ref),
      assign: (trackerRef, context) => {
        const found = findTrackerByRef(get().trackers, trackerRef);
        if (!found) {
          return null;
        }
        if (found.status === "expended") {
          return null;
        }
        if (found.status === "assigned" && found.assigned_launch_id && found.assigned_launch_id !== context.launchId) {
          return null;
        }
        let next = get().trackers;
        if (context.launchId) {
          next = next.map((item) =>
            item.assigned_launch_id === context.launchId && item.id !== found.id
              ? {
                  ...item,
                  status: "available",
                  assigned_mission_id: null,
                  assigned_task_id: null,
                  assigned_launch_id: null,
                  assigned_asset_id: null,
                }
              : item,
          );
        }
        next = next.map((item) =>
          item.id === found.id
            ? {
                ...item,
                status: "assigned",
                assigned_launch_id: context.launchId,
                assigned_asset_id: context.assetId ?? null,
                assigned_task_id: context.taskId ?? null,
                assigned_mission_id: context.missionId ?? null,
              }
            : item,
        );
        set({ trackers: next });
        return next.find((item) => item.id === found.id) ?? null;
      },
      release: (trackerRef) => {
        const found = findTrackerByRef(get().trackers, trackerRef);
        if (!found) {
          return null;
        }
        const next = releaseTracker(get().trackers, trackerRef);
        set({ trackers: next });
        return next.find((item) => item.id === found.id) ?? null;
      },
      releaseByLaunch: (launchId) => {
        set({
          trackers: get().trackers.map((item) =>
            item.assigned_launch_id === launchId
              ? {
                  ...item,
                  status: item.status === "expended" ? "expended" : "available",
                  assigned_mission_id: item.status === "expended" ? item.assigned_mission_id : null,
                  assigned_task_id: item.status === "expended" ? item.assigned_task_id : null,
                  assigned_launch_id: item.status === "expended" ? item.assigned_launch_id : null,
                  assigned_asset_id: item.status === "expended" ? item.assigned_asset_id : null,
                }
              : item,
          ),
        });
      },
      releaseAllForTask: (taskId) => {
        set({
          trackers: get().trackers.map((item) =>
            item.assigned_task_id === taskId && item.status !== "expended"
              ? {
                  ...item,
                  status: "available",
                  assigned_mission_id: null,
                  assigned_task_id: null,
                  assigned_launch_id: null,
                  assigned_asset_id: null,
                }
              : item,
          ),
        });
      },
      releaseAllForMission: (missionId) => {
        set({
          trackers: get().trackers.map((item) =>
            item.assigned_mission_id === missionId && item.status !== "expended"
              ? {
                  ...item,
                  status: "available",
                  assigned_mission_id: null,
                  assigned_task_id: null,
                  assigned_launch_id: null,
                  assigned_asset_id: null,
                }
              : item,
          ),
        });
      },
      markExpended: (trackerRefs) => {
        const ids = new Set(
          trackerRefs
            .map((ref) => findTrackerByRef(get().trackers, ref)?.id)
            .filter((id): id is string => Boolean(id)),
        );
        if (ids.size === 0) {
          return;
        }
        set({
          trackers: get().trackers.map((item) => (ids.has(item.id) ? { ...item, status: "expended" } : item)),
        });
      },
      syncLaunchAssignment: (launchId, previousSerial, nextSerial, context) => {
        const prev = (previousSerial ?? "").trim();
        const next = (nextSerial ?? "").trim();
        if (prev === next) {
          return;
        }
        if (prev) {
          get().release(prev);
        }
        if (next) {
          get().assign(next, { launchId, ...context });
        } else {
          get().releaseByLaunch(launchId);
        }
      },
    }),
    {
      name: TRACKER_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ trackers: state.trackers }),
      merge: (persisted, current) => {
        const raw =
          persisted && typeof persisted === "object" && "trackers" in persisted
            ? (persisted as { trackers: unknown }).trackers
            : persisted;
        return {
          ...current,
          trackers: normalizeTrackersPool(raw),
        };
      },
    },
  ),
);

export function resetTrackerStore() {
  useTrackerStore.persist.clearStorage();
  useTrackerStore.setState({ trackers: createInitialTrackersPool() });
}
