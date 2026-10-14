import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StatusFilter } from "@/types/target";

export const TARGET_FILTER_STORE_KEY = "military_crm_target_filter_store";

export interface TargetFilterState {
  query: string;
  status: StatusFilter;
}

export const DEFAULT_TARGET_FILTERS: TargetFilterState = {
  query: "",
  status: "active",
};

interface TargetFilterStore {
  filters: TargetFilterState;
  setFilters: (filters: TargetFilterState) => void;
  reset: () => void;
}

export const useTargetFilterStore = create<TargetFilterStore>()(
  persist(
    (set) => ({
      filters: { ...DEFAULT_TARGET_FILTERS },
      setFilters: (filters) => set({ filters: { ...filters } }),
      reset: () => set({ filters: { ...DEFAULT_TARGET_FILTERS } }),
    }),
    {
      name: TARGET_FILTER_STORE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ filters: state.filters }),
    },
  ),
);

export function resetTargetFilterStore() {
  useTargetFilterStore.persist.clearStorage();
  useTargetFilterStore.setState({ filters: { ...DEFAULT_TARGET_FILTERS } });
}
