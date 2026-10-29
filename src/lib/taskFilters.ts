import type { Mission, MissionStatusFilter } from "@/types/mission";
import { formatIsoDate, parseIsoDate, startOfDay } from "@/lib/dates";
import {
  DEFAULT_TASK_FILTERS,
  type TaskFilterState,
} from "@/store/useTaskFilterStore";

const STATUSES: MissionStatusFilter[] = ["active", "reported", "archived", "cancelled", "all"];

function missionSearchQuery(mission: Mission): string {
  const name = mission.name?.trim();
  if (name) {
    return name;
  }
  return mission.label.trim();
}

function parseStatus(value: string | null): MissionStatusFilter {
  if (value && STATUSES.includes(value as MissionStatusFilter)) {
    return value as MissionStatusFilter;
  }
  return DEFAULT_TASK_FILTERS.status;
}

function parseDateParam(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return value;
}

export function hasTaskFilterParams(params: URLSearchParams): boolean {
  return (
    params.has("missionId") ||
    params.has("q") ||
    params.has("from") ||
    params.has("to") ||
    params.has("status") ||
    params.has("detachment") ||
    params.has("targetId") ||
    params.has("view")
  );
}

export function taskFiltersFromSearchParams(
  params: URLSearchParams,
  missions: Mission[],
): TaskFilterState | null {
  if (!hasTaskFilterParams(params)) {
    return null;
  }
  const missionId = params.get("missionId");
  const mission = missions.find((item) => item.id === missionId);
  const explicitQuery = params.has("q") || params.has("from") || params.has("to");
  let query = params.get("q") ?? "";
  let dateFrom = parseDateParam(params.get("from"));
  let dateTo = parseDateParam(params.get("to"));
  if (mission && !explicitQuery) {
    query = missionSearchQuery(mission);
    const day = formatIsoDate(startOfDay(new Date(mission.scheduled_at)));
    dateFrom = day;
    dateTo = day;
  }
  return {
    query,
    status: parseStatus(params.get("status")),
    dateFrom,
    dateTo,
    organizationId: params.get("detachment") ?? "",
    viewMode: params.get("view") === "target" ? "target" : "daily",
  };
}

export function taskFiltersToSearchParams(
  filters: TaskFilterState,
  extra?: { targetId?: string | null },
): Record<string, string> {
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
  if (filters.status !== DEFAULT_TASK_FILTERS.status) {
    params.status = filters.status;
  }
  if (filters.organizationId) {
    params.detachment = filters.organizationId;
  }
  if (filters.viewMode === "target") {
    params.view = "target";
  }
  if (extra?.targetId) {
    params.targetId = extra.targetId;
  }
  return params;
}

export function taskFilterRange(filters: TaskFilterState): [Date | null, Date | null] {
  return [
    filters.dateFrom ? parseIsoDate(filters.dateFrom) : null,
    filters.dateTo ? parseIsoDate(filters.dateTo) : null,
  ];
}

export function sameTaskFilters(left: TaskFilterState, right: TaskFilterState): boolean {
  return (
    left.query === right.query &&
    left.status === right.status &&
    left.dateFrom === right.dateFrom &&
    left.dateTo === right.dateTo &&
    left.organizationId === right.organizationId &&
    left.viewMode === right.viewMode
  );
}
