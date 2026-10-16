import { useEffect } from "react";
import { ClipboardList, Search, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Card } from "@/components/ui/card";
import { AppDateRangePicker } from "@/components/ui/date-picker";
import { HeaderMetricCards } from "@/components/ui/header-metric-cards";
import { Input } from "@/components/ui/input";
import { ResetFiltersIconButton } from "@/components/ui/icon-buttons";
import { StatusFilterSelect } from "@/components/ui/status-filter-select";
import { DICTIONARY } from "@/constants/dictionary";
import { hidesDetachmentFilter, locksDetachmentFilter, taskInScope, withSessionScope } from "@/lib/access";
import { formatIsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  sameTaskFilters,
  taskFilterRange,
  taskFiltersFromSearchParams,
  taskFiltersToSearchParams,
} from "@/lib/taskFilters";
import { useAuthStore } from "@/store/useAuthStore";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useMissionStore } from "@/store/useMissionStore";
import { filterTasks, getTaskMetrics, useTaskStore } from "@/store/useTaskStore";
import { useTargetStore } from "@/store/useTargetStore";
import { DEFAULT_TASK_FILTERS, useTaskFilterStore, type TaskFilterState } from "@/store/useTaskFilterStore";
import type { MissionStatusFilter } from "@/types/mission";
import { notifySuccess } from "@/lib/toasts";
import { DETACHMENT_REFS } from "@/data/crews";
import { useReportStore } from "@/store/useReportStore";
import { matchingReports } from "@/lib/reportAggregation";

export function TasksPlanningPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useTaskFilterStore((state) => state.filters);
  const setFilters = useTaskFilterStore((state) => state.setFilters);
  const tasks = useTaskStore((state) => state.tasks);
  const role = useAuthStore((state) => state.role);
  const entityId = useAuthStore((state) => state.entityId);
  const detachmentLocked = locksDetachmentFilter(role);
  const hideDetachment = hidesDetachmentFilter(role);
  const activeFilters = withSessionScope(filters, role, entityId);
  const restoreTask = useTaskStore((state) => state.restoreTask);
  const missions = useMissionStore((state) => state.missions);
  const targets = useTargetStore((state) => state.targets);
  const aimingPoints = useTargetStore((state) => state.aimingPoints);
  const battleGroups = useBattleGroupStore((state) => state.battleGroups);
  const targetId = searchParams.get("targetId");
  const reports = useReportStore((state) => state.reports);

  useEffect(() => {
    const parsed = taskFiltersFromSearchParams(searchParams, missions);
    const current = useTaskFilterStore.getState().filters;
    const next = withSessionScope(parsed ?? current, role, entityId);
    if (!sameTaskFilters(current, next)) {
      setFilters(next);
    }
    if (role === "DETACHMENT" && entityId && searchParams.get("detachment") !== entityId) {
      setSearchParams(taskFiltersToSearchParams(next, { targetId: searchParams.get("targetId") }), { replace: true });
    }
  }, [searchParams, missions, setFilters, setSearchParams, role, entityId]);

  const applyFilters = (next: TaskFilterState) => {
    const scoped = withSessionScope(next, role, entityId);
    setFilters(scoped);
    setSearchParams(taskFiltersToSearchParams(scoped, { targetId }), { replace: true });
  };

  const resetFilters = () => {
    const scoped = withSessionScope({ ...DEFAULT_TASK_FILTERS }, role, entityId);
    setFilters(scoped);
    setSearchParams(taskFiltersToSearchParams(scoped), { replace: true });
  };

  const [from, to] = taskFilterRange(activeFilters);
  const visibleTasks = filterTasks(
    tasks.filter((task) => taskInScope(task, role, entityId)),
    missions,
    targets,
    activeFilters.query,
    activeFilters.status,
    from,
    to,
    targetId,
    null,
    activeFilters.organizationId || null,
  );
  const metrics = getTaskMetrics(visibleTasks);

  return (
    <section className="flex h-full min-h-0 flex-col gap-4">
      <h1 className="sr-only">{DICTIONARY.tasks.title}</h1>
      <HeaderMetricCards
        metrics={{
          total: metrics.total,
          completed: metrics.reported,
          active: metrics.active,
          archived: metrics.archived,
        }}
      />
      <div className="flex flex-col gap-3  lg:flex-row lg:items-center">
        <div className="w-full min-w-48 lg:w-48">
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
        <div className="relative min-w-0 flex-1 max-w-60">
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
        <div className="relative w-full min-w-0 lg:w-40">
          <select
            value={activeFilters.organizationId}
            disabled={detachmentLocked}
            onChange={(event) => applyFilters({ ...activeFilters, organizationId: event.target.value })}
            aria-label={DICTIONARY.tasks.detachment}
            className={cn(
              "h-9 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-sm text-primitive-neutral-0 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
              activeFilters.organizationId && !detachmentLocked ? "pr-9" : "",
            )}
          >
            <option value="">{DICTIONARY.missions.select_detachment}</option>
            {DETACHMENT_REFS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {activeFilters.organizationId && !detachmentLocked ? (
            <button
              type="button"
              title={DICTIONARY.common.actions.clear}
              aria-label={DICTIONARY.common.actions.clear}
              onClick={() => applyFilters({ ...activeFilters, organizationId: "" })}
              className="absolute right-6 top-1/2 -translate-y-1/2 rounded-full p-1 text-primitive-neutral-300 hover:cursor-pointer hover:bg-primitive-neutral-850 hover:shadow-md"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        )}
        <div className="w-full min-w-0 lg:w-[120px]">
          <StatusFilterSelect
            value={filters.status}
            onChange={(value) => applyFilters({ ...activeFilters, status: value as MissionStatusFilter })}
          />
        </div>
        <ResetFiltersIconButton onClick={resetFilters} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {visibleTasks.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Card className="w-full items-center gap-3 text-center justify-center">
              <ClipboardList className="h-8 w-8 text-primitive-neutral-500" aria-hidden="true" />
              <p className="text-sm text-primitive-neutral-300">{DICTIONARY.tasks.empty}</p>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 3xl:grid-cols-3">
            {visibleTasks.map((task) => {
              const currentMissionReports = matchingReports(reports, [task.organization_id], task.scheduled_at);
              const reportId = currentMissionReports.find((report) => report.organization_id === task.organization_id)?.id ?? ""
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  missions={missions}
                  reportId={reportId}
                  targets={targets}
                  aimingPoints={aimingPoints}
                  battleGroups={battleGroups.filter(
                    (group) => group.task_id === task.id || task.battle_groups_ids.includes(group.id),
                  )}
                  onPreview={(item) => navigate(`/planning/tasks/${item.id}`)}
                  onRestore={(item) => {
                    restoreTask(item.id);
                    notifySuccess(DICTIONARY.tasks.toasts.task_restored);
                  }}
                />
              )
            })}
          </div>
        )}
      </div>
    </section>
  );
}
