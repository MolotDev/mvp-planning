import { useEffect } from "react";
import { Rocket, Search, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LaunchGroupCards, launchPreviewPath, scopesFromRows } from "@/components/launches/LaunchGroupCards";
import { LaunchTable } from "@/components/launches/LaunchTable";
import { Card } from "@/components/ui/card";
import { AppDateRangePicker } from "@/components/ui/date-picker";
import { HeaderMetricCards } from "@/components/ui/header-metric-cards";
import { Input } from "@/components/ui/input";
import { ResetFiltersIconButton } from "@/components/ui/icon-buttons";
import { StatusFilterSelect } from "@/components/ui/status-filter-select";
import { DICTIONARY } from "@/constants/dictionary";
import { CREWS, DETACHMENT_REFS } from "@/data/crews";
import { hidesDetachmentFilter, launchInScope, locksCrewFilter, locksDetachmentFilter, withSessionScope } from "@/lib/access";
import { formatIsoDate } from "@/lib/dates";
import { matchesEntityStatusFilter } from "@/lib/entityState";
import { filterLaunchRows, getLaunchStateMetrics, launchBelongsToCurrentRequest } from "@/lib/launchBoard";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import {
  DEFAULT_LAUNCH_FILTERS,
  launchFilterRange,
  launchFiltersFromSearchParams,
  launchFiltersToSearchParams,
  sameLaunchFilters,
  useLaunchFilterStore,
  type LaunchFilterState,
} from "@/store/useLaunchFilterStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useTargetStore } from "@/store/useTargetStore";
import { useTaskStore } from "@/store/useTaskStore";
import type { MissionStatusFilter } from "@/types/mission";

export function LaunchesPlanningPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useLaunchFilterStore((state) => state.filters);
  const setFilters = useLaunchFilterStore((state) => state.setFilters);
  const launches = useLaunchStore((state) => state.launches);
  const battleGroups = useBattleGroupStore((state) => state.battleGroups);
  const tasks = useTaskStore((state) => state.tasks);
  const missions = useMissionStore((state) => state.missions);
  const targets = useTargetStore((state) => state.targets);
  const aimingPoints = useTargetStore((state) => state.aimingPoints);
  const role = useAuthStore((state) => state.role);
  const entityId = useAuthStore((state) => state.entityId);
  const detachmentLocked = locksDetachmentFilter(role);
  const crewLocked = locksCrewFilter(role);
  const hideDetachment = hidesDetachmentFilter(role);
  const hideCrew = role === "CREW";
  const activeFilters = withSessionScope(filters, role, entityId);

  useEffect(() => {
    const parsed = launchFiltersFromSearchParams(searchParams);
    const current = useLaunchFilterStore.getState().filters;
    const next = withSessionScope(parsed ?? current, role, entityId);
    if (!sameLaunchFilters(current, next)) {
      setFilters(next);
    }
    const detachmentMismatch = role === "DETACHMENT" && entityId && searchParams.get("detachment") !== entityId;
    const crewMismatch =
      role === "CREW" && entityId && (searchParams.get("crew") !== entityId || searchParams.has("detachment"));
    if (detachmentMismatch || crewMismatch) {
      setSearchParams(launchFiltersToSearchParams(next), { replace: true });
    }
  }, [searchParams, setFilters, setSearchParams, role, entityId]);

  const applyFilters = (next: LaunchFilterState) => {
    const scoped = withSessionScope(next, role, entityId);
    setFilters(scoped);
    setSearchParams(launchFiltersToSearchParams(scoped), { replace: true });
  };

  const resetFilters = () => {
    const scoped = withSessionScope(
      { ...DEFAULT_LAUNCH_FILTERS, groupMode: useLaunchFilterStore.getState().filters.groupMode },
      role,
      entityId,
    );
    setFilters(scoped);
    setSearchParams(launchFiltersToSearchParams(scoped), { replace: true });
  };

  const [from, to] = launchFilterRange(activeFilters);
  const rows = filterLaunchRows(
    launches,
    tasks,
    missions,
    targets,
    aimingPoints,
    battleGroups,
    activeFilters.query,
    from,
    to,
    activeFilters.organizationId,
    activeFilters.crewId,
    true,
  ).filter((row) => matchesEntityStatusFilter(row.launch, activeFilters.status))
    .filter((row) => launchBelongsToCurrentRequest(row))
    .filter((row) => launchInScope(role, entityId, row.task, row.battleGroup));
  const metrics = getLaunchStateMetrics(rows.map((row) => row.launch));
  const board = DICTIONARY.tasks.launch_board;

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <HeaderMetricCards
        metrics={{
          total: metrics.total,
          completed: metrics.reported,
          active: metrics.active,
          archived: metrics.archived,
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-48 w-48 flex-1 basis-0 overflow-hidden [&_.react-datepicker-wrapper]:w-full [&_.react-datepicker-wrapper]:min-w-0 [&_.react-datepicker__input-container]:block [&_.react-datepicker__input-container]:w-full [&_.react-datepicker__input-container]:min-w-0">
          <AppDateRangePicker
            startDate={from}
            endDate={to}
            onChange={(range) =>
              applyFilters({
                ...activeFilters,
                dateFrom: range[0] ? formatIsoDate(range[0]) : null,
                dateTo: range[1] ? formatIsoDate(range[1]) : null,
              })
            }
            placeholder={DICTIONARY.tasks.date_range}
          />
        </div>
        <div className="relative min-w-0 flex-1 basis-0">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primitive-neutral-500"
            aria-hidden="true"
          />
          <Input
            value={activeFilters.query}
            onChange={(event) => applyFilters({ ...activeFilters, query: event.target.value })}
            placeholder={DICTIONARY.common.actions.search}
            className="pl-9 pr-9"
            aria-label={DICTIONARY.common.actions.search}
          />
          {activeFilters.query ? (
            <button
              type="button"
              title={DICTIONARY.common.actions.clear}
              aria-label={DICTIONARY.common.actions.clear}
              onClick={() => applyFilters({ ...activeFilters, query: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-primitive-neutral-300 hover:cursor-pointer hover:bg-primitive-neutral-850 hover:shadow-md"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {hideDetachment ? null : (
          <FilterSelect
            className="w-full min-w-0 xl:w-40"
            label={DICTIONARY.tasks.detachment}
            value={activeFilters.organizationId}
            placeholder={DICTIONARY.missions.select_detachment}
            options={DETACHMENT_REFS.map((item) => ({ id: item.id, name: item.name }))}
            disabled={detachmentLocked}
            onChange={(organizationId) => applyFilters({ ...activeFilters, organizationId })}
            onClear={() => applyFilters({ ...activeFilters, organizationId: "" })}
          />
        )}
        {hideCrew ? null : (
          <FilterSelect
            className="w-full min-w-0 xl:w-40"
            label={board.crew}
            value={activeFilters.crewId}
            placeholder={board.select_crew}
            options={CREWS.map((crew) => ({ id: crew.id, name: crew.name }))}
            disabled={crewLocked}
            onChange={(crewId) => applyFilters({ ...activeFilters, crewId })}
            onClear={() => applyFilters({ ...activeFilters, crewId: "" })}
          />
        )}
        <div className="w-full min-w-0 xl:w-[120px]">
          <StatusFilterSelect
            value={filters.status}
            onChange={(status) => applyFilters({ ...activeFilters, status: status as MissionStatusFilter })}
          />
        </div>
        <ResetFiltersIconButton className="shrink-0" onClick={resetFilters} />
        <div className="min-w-0 flex-1 basis-0">
          <select
            aria-label={board.group_mode}
            value={activeFilters.groupMode}
            onChange={(event) =>
              applyFilters({ ...activeFilters, groupMode: event.target.value as LaunchFilterState["groupMode"] })
            }
            className="h-9 w-full min-w-0 max-w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-sm text-primitive-neutral-0 hover:cursor-pointer"
          >
            <option value="battle_group">{board.by_battle_group}</option>
            <option value="task">{board.by_task}</option>
            <option value="table">{board.table}</option>
          </select>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-1">
        {rows.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Card className="w-full items-center gap-3 text-center justify-center">
              <Rocket className="h-8 w-8 text-primitive-neutral-500" aria-hidden="true" />
              <p className="text-sm text-primitive-neutral-300">{DICTIONARY.launches.empty}</p>
            </Card>
          </div>
        ) : activeFilters.groupMode === "table" ? (
          <LaunchTable rows={rows} />
        ) : (
          <LaunchGroupCards
            scopes={scopesFromRows(rows, activeFilters.groupMode === "task" ? "task" : "battle_group")}
            aimingPoints={aimingPoints}
            onPreview={(scope) => navigate(launchPreviewPath(scope))}
          />
        )}
      </div>
    </section>
  );
}

function FilterSelect({
  className,
  label,
  value,
  placeholder,
  options,
  disabled = false,
  onChange,
  onClear,
}: {
  className?: string;
  label: string;
  value: string;
  placeholder: string;
  options: { id: string; name: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-9 w-full min-w-0 max-w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-sm text-primitive-neutral-0 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
          value && !disabled ? "pr-9" : "",
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {value && !disabled ? (
        <button
          type="button"
          title={DICTIONARY.common.actions.clear}
          aria-label={DICTIONARY.common.actions.clear}
          onClick={onClear}
          className="absolute right-6 top-1/2 -translate-y-1/2 rounded-full p-1 text-primitive-neutral-300 hover:cursor-pointer hover:bg-primitive-neutral-850 hover:shadow-md"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
