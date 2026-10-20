import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { MissionViewMode } from "@/lib/missionView";
import type { MissionStatusFilter } from "@/types/mission";

export const TASK_FILTER_STORE_KEY = "military_crm_task_filter_store";

export interface TaskFilterState {
  query: string;
  status: MissionStatusFilter;
  dateFrom: string | null;
  dateTo: string | null;
  organizationId: string;
  viewMode: MissionViewMode;
}

export const DEFAULT_TASK_FILTERS: TaskFilterState = {
  query: "",
  status: "all",
  dateFrom: null,
  dateTo: null,
  organizationId: "",
  viewMode: "daily",
};

interface TaskFilterStore {
  filters: TaskFilterState;
  setFilters: (filters: TaskFilterState) => void;
  reset: () => void;
}

function normalizeTaskFilters(value: Partial<TaskFilterState> | undefined): TaskFilterState {
  return {
    query: typeof value?.query === "string" ? value.query : "",
    status: value?.status ?? DEFAULT_TASK_FILTERS.status,
    dateFrom: value?.dateFrom ?? null,
    dateTo: value?.dateTo ?? null,
    organizationId: typeof value?.organizationId === "string" ? value.organizationId : "",
    viewMode: value?.viewMode === "target" ? "target" : "daily",
  };
}

export const useTaskFilterStore = create<TaskFilterStore>()(
  persist(
    (set) => ({
      filters: { ...DEFAULT_TASK_FILTERS },
      setFilters: (filters) => set({ filters: normalizeTaskFilters(filters) }),
      reset: () => set({ filters: { ...DEFAULT_TASK_FILTERS } }),
    }),
    {
      name: TASK_FILTER_STORE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ filters: state.filters }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { filters?: Partial<TaskFilterState> } | undefined;
        return {
          ...currentState,
          filters: normalizeTaskFilters(persisted?.filters),
        };
      },
    },
  ),
);

export function resetTaskFilterStore() {
  useTaskFilterStore.persist.clearStorage();
  useTaskFilterStore.setState({ filters: { ...DEFAULT_TASK_FILTERS } });
}
