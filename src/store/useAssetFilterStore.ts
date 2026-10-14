import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AssetStatusFilter } from "@/types/asset";

export const ASSET_FILTER_STORE_KEY = "military_crm_asset_filter_store";

export interface AssetFilterState {
  query: string;
  status: AssetStatusFilter;
}

export const DEFAULT_ASSET_FILTERS: AssetFilterState = {
  query: "",
  status: "active",
};

interface AssetFilterStore {
  filters: AssetFilterState;
  setFilters: (filters: AssetFilterState) => void;
  reset: () => void;
}

export const useAssetFilterStore = create<AssetFilterStore>()(
  persist(
    (set) => ({
      filters: { ...DEFAULT_ASSET_FILTERS },
      setFilters: (filters) => set({ filters: { ...filters } }),
      reset: () => set({ filters: { ...DEFAULT_ASSET_FILTERS } }),
    }),
    {
      name: ASSET_FILTER_STORE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ filters: state.filters }),
    },
  ),
);
