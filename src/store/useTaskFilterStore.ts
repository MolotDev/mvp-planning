import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { MissionStatusFilter } from "@/types/mission";

export const TASK_FILTER_STORE_KEY = "military_crm_task_filter_store";

export interface TaskFilterState {
  query: string;
  status: MissionStatusFilter;
  dateFrom: string | null;
  dateTo: string | null;
  organizationId: string;
}

export const DEFAULT_TASK_FILTERS: TaskFilterState = {
  query: "",
  status: "all",
  dateFrom: null,
  dateTo: null,
  organizationId: "",
};

interface TaskFilterStore {
  filters: TaskFilterState;
  setFilters: (filters: TaskFilterState) => void;
  reset: () => void;
}

export const useTaskFilterStore = create<TaskFilterStore>()(
  persist(
    (set) => ({
      filters: { ...DEFAULT_TASK_FILTERS },
      setFilters: (filters) => set({ filters: { ...filters } }),
      reset: () => set({ filters: { ...DEFAULT_TASK_FILTERS } }),
    }),
    {
      name: TASK_FILTER_STORE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ filters: state.filters }),
    },
  ),
);

export function resetTaskFilterStore() {
  useTaskFilterStore.persist.clearStorage();
  useTaskFilterStore.setState({ filters: { ...DEFAULT_TASK_FILTERS } });
}
