import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { MissionViewMode } from "@/lib/missionView";
import type { MissionStatusFilter } from "@/types/mission";

export const MISSION_FILTER_STORE_KEY = "military_crm_mission_filter_store";

export interface MissionFilterState {
  query: string;
  status: MissionStatusFilter;
  dateFrom: string | null;
  dateTo: string | null;
  viewMode: MissionViewMode;
}

export const DEFAULT_MISSION_FILTERS: MissionFilterState = {
  query: "",
  status: "all",
  dateFrom: null,
  dateTo: null,
  viewMode: "daily",
};

const STATUSES: MissionStatusFilter[] = ["active", "reported", "archived", "cancelled", "all"];

interface MissionFilterStore {
  filters: MissionFilterState;
  setFilters: (filters: MissionFilterState) => void;
  reset: () => void;
}

function dateParam(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return value;
}

export function normalizeMissionFilters(value: Partial<MissionFilterState> | undefined): MissionFilterState {
  return {
    query: typeof value?.query === "string" ? value.query : "",
    status: STATUSES.includes(value?.status as MissionStatusFilter)
      ? (value?.status as MissionStatusFilter)
      : DEFAULT_MISSION_FILTERS.status,
    dateFrom: dateParam(value?.dateFrom),
    dateTo: dateParam(value?.dateTo),
    viewMode: value?.viewMode === "target" ? "target" : "daily",
  };
}

export const useMissionFilterStore = create<MissionFilterStore>()(
  persist(
    (set) => ({
      filters: { ...DEFAULT_MISSION_FILTERS },
      setFilters: (filters) => set({ filters: normalizeMissionFilters(filters) }),
      reset: () => set({ filters: { ...DEFAULT_MISSION_FILTERS } }),
    }),
    {
      name: MISSION_FILTER_STORE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ filters: state.filters }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { filters?: Partial<MissionFilterState> } | undefined;
        return {
          ...currentState,
          filters: normalizeMissionFilters(persisted?.filters),
        };
      },
    },
  ),
);

export function resetMissionFilterStore() {
  useMissionFilterStore.persist.clearStorage();
  useMissionFilterStore.setState({ filters: { ...DEFAULT_MISSION_FILTERS } });
}
