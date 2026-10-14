import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ReportStatusFilter } from "@/types/report";

export const REPORT_FILTER_STORE_KEY = "military_crm_report_filter_store";

export interface ReportFilterState {
  query: string;
  status: ReportStatusFilter;
  reportDate: string | null;
  organizationId: string;
}

export const DEFAULT_REPORT_FILTERS: ReportFilterState = {
  query: "",
  status: "all",
  reportDate: null,
  organizationId: "",
};

interface ReportFilterStore {
  filters: ReportFilterState;
  setFilters: (filters: ReportFilterState) => void;
  reset: () => void;
}

export const useReportFilterStore = create<ReportFilterStore>()(
  persist(
    (set) => ({
      filters: { ...DEFAULT_REPORT_FILTERS },
      setFilters: (filters) => set({ filters: { ...filters } }),
      reset: () => set({ filters: { ...DEFAULT_REPORT_FILTERS } }),
    }),
    {
      name: REPORT_FILTER_STORE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ filters: state.filters }),
    },
  ),
);

export function resetReportFilterStore() {
  useReportFilterStore.persist.clearStorage();
  useReportFilterStore.setState({ filters: { ...DEFAULT_REPORT_FILTERS } });
}
