import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { formatIsoDate, parseIsoDate } from "@/lib/dates";
import type { MissionStatusFilter } from "@/types/mission";

export const LAUNCH_FILTER_STORE_KEY = "military_crm_launch_filter_store";

export type LaunchGroupMode = "battle_group" | "task" | "table";

export interface LaunchFilterState {
  query: string;
  dateFrom: string | null;
  dateTo: string | null;
  organizationId: string;
  crewId: string;
  groupMode: LaunchGroupMode;
  status: MissionStatusFilter;
}

export const DEFAULT_LAUNCH_FILTERS: LaunchFilterState = {
  query: "",
  dateFrom: null,
  dateTo: null,
  organizationId: "",
  crewId: "",
  groupMode: "battle_group",
  status: "all",
};

const GROUP_MODES: LaunchGroupMode[] = ["battle_group", "task", "table"];
const STATUSES: MissionStatusFilter[] = ["active", "reported", "archived", "all"];

interface LaunchFilterStore {
  filters: LaunchFilterState;
  setFilters: (filters: LaunchFilterState) => void;
  reset: () => void;
}

function normalizeFilters(value: Partial<LaunchFilterState> | undefined): LaunchFilterState {
  const groupMode = GROUP_MODES.includes(value?.groupMode as LaunchGroupMode)
    ? (value?.groupMode as LaunchGroupMode)
    : DEFAULT_LAUNCH_FILTERS.groupMode;
  return {
    query: typeof value?.query === "string" ? value.query : "",
    dateFrom: value?.dateFrom ?? null,
    dateTo: value?.dateTo ?? null,
    organizationId: value?.organizationId ?? "",
    crewId: value?.crewId ?? "",
    groupMode,
    status: STATUSES.includes(value?.status as MissionStatusFilter)
      ? (value?.status as MissionStatusFilter)
      : DEFAULT_LAUNCH_FILTERS.status,
  };
}

export const useLaunchFilterStore = create<LaunchFilterStore>()(
  persist(
    (set) => ({
      filters: { ...DEFAULT_LAUNCH_FILTERS },
      setFilters: (filters) => set({ filters: normalizeFilters(filters) }),
      reset: () => set(state => ({ filters: { ...DEFAULT_LAUNCH_FILTERS, groupMode: state.filters.groupMode } })),
    }),
    {
      name: LAUNCH_FILTER_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ filters: state.filters }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { filters?: Partial<LaunchFilterState> } | undefined;
        return {
          ...currentState,
          filters: normalizeFilters(persisted?.filters),
        };
      },
    },
  ),
);

export function resetLaunchFilterStore() {
  useLaunchFilterStore.persist.clearStorage();
  useLaunchFilterStore.setState({ filters: { ...DEFAULT_LAUNCH_FILTERS } });
}

export function hasLaunchFilterParams(params: URLSearchParams): boolean {
  return (
    params.has("q") ||
    params.has("from") ||
    params.has("to") ||
    params.has("detachment") ||
    params.has("crew") ||
    params.has("view") ||
    params.has("status")
  );
}

export function launchFiltersFromSearchParams(params: URLSearchParams): LaunchFilterState | null {
  if (!hasLaunchFilterParams(params)) {
    return null;
  }
  const view = params.get("view");
  return normalizeFilters({
    query: params.get("q") ?? "",
    dateFrom: params.get("from"),
    dateTo: params.get("to"),
    organizationId: params.get("detachment") ?? "",
    crewId: params.get("crew") ?? "",
    groupMode: GROUP_MODES.includes(view as LaunchGroupMode) ? (view as LaunchGroupMode) : "battle_group",
    status: STATUSES.includes(params.get("status") as MissionStatusFilter)
      ? (params.get("status") as MissionStatusFilter)
      : "all",
  });
}

export function launchFiltersToSearchParams(filters: LaunchFilterState): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.query) {
    params.q = filters.query;
  }
  if (filters.dateFrom) {
    params.from = filters.dateFrom;
  }
  if (filters.dateTo) {
    params.to = filters.dateTo;
  }
  if (filters.organizationId) {
    params.detachment = filters.organizationId;
  }
  if (filters.crewId) {
    params.crew = filters.crewId;
  }
  if (filters.groupMode !== DEFAULT_LAUNCH_FILTERS.groupMode) {
    params.view = filters.groupMode;
  }
  if (filters.status !== DEFAULT_LAUNCH_FILTERS.status) {
    params.status = filters.status;
  }
  return params;
}

export function sameLaunchFilters(left: LaunchFilterState, right: LaunchFilterState): boolean {
  return (
    left.query === right.query &&
    left.dateFrom === right.dateFrom &&
    left.dateTo === right.dateTo &&
    left.organizationId === right.organizationId &&
    left.crewId === right.crewId &&
    left.groupMode === right.groupMode &&
    left.status === right.status
  );
}

export function launchFilterRange(filters: LaunchFilterState): [Date | null, Date | null] {
  return [
    filters.dateFrom ? parseIsoDate(filters.dateFrom) : null,
    filters.dateTo ? parseIsoDate(filters.dateTo) : null,
  ];
}

export { formatIsoDate };
