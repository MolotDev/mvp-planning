import { parseIsoDate } from "@/lib/dates";
import {
  DEFAULT_MISSION_FILTERS,
  normalizeMissionFilters,
  type MissionFilterState,
} from "@/store/useMissionFilterStore";

export function hasMissionFilterParams(params: URLSearchParams): boolean {
  return params.has("q") || params.has("from") || params.has("to") || params.has("status") || params.has("view");
}

export function missionFiltersFromSearchParams(params: URLSearchParams): MissionFilterState | null {
  if (!hasMissionFilterParams(params)) {
    return null;
  }
  return normalizeMissionFilters({
    query: params.get("q") ?? "",
    status: (params.get("status") ?? undefined) as MissionFilterState["status"] | undefined,
    dateFrom: params.get("from"),
    dateTo: params.get("to"),
    viewMode: params.get("view") === "target" ? "target" : "daily",
  });
}

export function missionFiltersToSearchParams(filters: MissionFilterState): Record<string, string> {
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
  if (filters.status !== DEFAULT_MISSION_FILTERS.status) {
    params.status = filters.status;
  }
  if (filters.viewMode === "target") {
    params.view = "target";
  }
  return params;
}

export function sameMissionFilters(left: MissionFilterState, right: MissionFilterState): boolean {
  return (
    left.query === right.query &&
    left.status === right.status &&
    left.dateFrom === right.dateFrom &&
    left.dateTo === right.dateTo &&
    left.viewMode === right.viewMode
  );
}

export function missionFilterRange(filters: MissionFilterState): [Date | null, Date | null] {
  return [
    filters.dateFrom ? parseIsoDate(filters.dateFrom) : null,
    filters.dateTo ? parseIsoDate(filters.dateTo) : null,
  ];
}
