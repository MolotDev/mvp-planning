import { useEffect, useMemo } from "react";
import { Calendar, ClipboardList, Search, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { AppDateRangePicker } from "@/components/ui/date-picker";
import { HeaderMetricCards } from "@/components/ui/header-metric-cards";
import { Input } from "@/components/ui/input";
import { ResetFiltersIconButton } from "@/components/ui/icon-buttons";
import { StatusFilterSelect } from "@/components/ui/status-filter-select";
import { DICTIONARY } from "@/constants/dictionary";
import { hidesDetachmentFilter, locksDetachmentFilter, taskInScope, withSessionScope } from "@/lib/access";
import { formatIsoDate, calculateDateOffset, convertDateToDdMmDayOfWeek, formatDateUk, getDaysArray, isBeforeToday, isLessThanOneDay, isMoreThanOneDay, isToday, startOfDay } from "@/lib/dates";
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
import type { MissionViewMode } from "@/lib/missionView";
import { splitTasksByTarget } from "@/lib/taskView";

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

  useEffect(() => {
    if (filters.dateFrom !== null) {
      return;
    }
    const today = calculateDateOffset(new Date(), 0).split("T")[0];
    if (filters.viewMode === "target") {
      setFilters({ ...filters, dateFrom: today, dateTo: null });
      return;
    }
    setFilters({
      ...filters,
      dateFrom: calculateDateOffset(new Date(), -2).split("T")[0],
      dateTo: calculateDateOffset(new Date(), 2).split("T")[0],
    });
  }, [filters, setFilters]);

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

  const handleViewModeChange = (viewMode: MissionViewMode) => {
    const today = calculateDateOffset(new Date(), 0).split("T")[0];
    if (viewMode === "daily") {
      applyFilters({
        ...activeFilters,
        viewMode,
        dateFrom: calculateDateOffset(new Date(), -2).split("T")[0],
        dateTo: calculateDateOffset(new Date(), 2).split("T")[0],
      });
      return;
    }
    applyFilters({
      ...activeFilters,
      viewMode,
      dateFrom: today,
      dateTo: null,
    });
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
  const dayColumns = useMemo(() => {
    if (activeFilters.viewMode !== "daily" || !from || !to) {
      return [];
    }
    return getDaysArray(from.toISOString(), to.toISOString()).map((date) => ({
      date,
      tasks: visibleTasks.filter(
        (task) => formatDateUk(task.scheduled_at || task.created_at) === formatDateUk(date.toString()),
      ),
    }));
  }, [activeFilters.viewMode, from, to, visibleTasks]);
  const targetCards = useMemo(
    () => (activeFilters.viewMode === "target" ? splitTasksByTarget(visibleTasks, missions, targets).slice(0, 5) : []),
    [activeFilters.viewMode, missions, targets, visibleTasks],
  );
  const metrics = getTaskMetrics(activeFilters.viewMode === "target" ? targetCards.map((card) => card.task) : visibleTasks);

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
        <div className="flex items-center gap-1 rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900/90 p-1">
          <button
            type="button"
            aria-pressed={activeFilters.viewMode === "daily"}
            onClick={() => handleViewModeChange("daily")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-all hover:cursor-pointer hover:shadow-md",
              activeFilters.viewMode === "daily"
                ? "border border-primitive-neutral-700 bg-primitive-neutral-800 text-primitive-neutral-0 shadow-sm"
                : "text-primitive-neutral-500 hover:text-primitive-neutral-200",
            )}
          >
            {DICTIONARY.missions.view_daily}
          </button>
          <button
            type="button"
            aria-pressed={activeFilters.viewMode === "target"}
            onClick={() => handleViewModeChange("target")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-all hover:cursor-pointer hover:shadow-md",
              activeFilters.viewMode === "target"
                ? "border border-primitive-neutral-700 bg-primitive-neutral-800 text-primitive-neutral-0 shadow-sm"
                : "text-primitive-neutral-500 hover:text-primitive-neutral-200",
            )}
          >
            {DICTIONARY.missions.view_target}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {activeFilters.viewMode === "target" ? (
          targetCards.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Card className="w-full items-center gap-3 text-center justify-center">
                <ClipboardList className="h-8 w-8 text-primitive-neutral-500" aria-hidden="true" />
                <p className="text-sm text-primitive-neutral-300">{DICTIONARY.tasks.empty}</p>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {targetCards.map((card) => {
                const currentMissionReports = matchingReports(reports, [card.task.organization_id], card.task.scheduled_at);
                const reportId = currentMissionReports.find((report) => report.organization_id === card.task.organization_id)?.id ?? "";
                return (
                  <TaskCard
                    key={`${card.task.id}:${card.targetId || card.label}`}
                    task={card.task}
                    missions={missions}
                    reportId={reportId}
                    targets={targets}
                    aimingPoints={aimingPoints}
                    battleGroups={battleGroups.filter(
                      (group) => group.task_id === card.task.id || card.task.battle_groups_ids.includes(group.id),
                    )}
                    focusTargetId={card.targetId}
                    displayLabel={card.label}
                    displayTitle={card.title}
                    onPreview={(item) =>
                      navigate(
                        card.targetId
                          ? `/planning/tasks/${item.id}?targetId=${card.targetId}`
                          : `/planning/tasks/${item.id}`,
                      )
                    }
                    onRestore={(item) => {
                      restoreTask(item.id);
                      notifySuccess(DICTIONARY.tasks.toasts.task_restored);
                    }}
                  />
                );
              })}
            </div>
          )
        ) : dayColumns.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Card className="w-full items-center gap-3 text-center justify-center">
              <ClipboardList className="h-8 w-8 text-primitive-neutral-500" aria-hidden="true" />
              <p className="text-sm text-primitive-neutral-300">{DICTIONARY.tasks.empty}</p>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {dayColumns.map(({ date, tasks: dayTasks }) => (
              <div
                key={date.toISOString()}
                className={cn(
                  "flex w-full flex-col gap-2 opacity-70 hover:opacity-100 transition-all duration-100",
                  isMoreThanOneDay(date) || isLessThanOneDay(date) ? "scale-[96%]" : "",
                  isToday(date) ? "scale-[102%] opacity-100" : "",
                )}
              >
                <div className="flex items-center gap-2">
                  <Badge className={cn("flex items-center bg-primitive-neutral-800 text-sm", isToday(date) ? "" : "bg-primitive-neutral-700")}>
                    <Calendar className="mr-1 h-3 w-3 shrink-0" aria-hidden="true" />
                    {convertDateToDdMmDayOfWeek(date)}
                  </Badge>
                  <span className="text-sm">{isToday(date) ? DICTIONARY.missions.today : ""}</span>
                </div>
                {dayTasks.length > 0 ? (
                  dayTasks.map((task) => {
                    const currentMissionReports = matchingReports(reports, [task.organization_id], task.scheduled_at);
                    const reportId = currentMissionReports.find((report) => report.organization_id === task.organization_id)?.id ?? "";
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
                    );
                  })
                ) : (
                  <Card className="min-h-60">
                    <CardBody className="justify-center gap-3 text-center">
                      <p className="text-sm text-primitive-neutral-300 opacity-60">{DICTIONARY.tasks.no_tasks}</p>
                      {role === "DETACHMENT" && entityId && !isBeforeToday(date) ? (
                        <Button
                          variant="outline"
                          className="text-xs"
                          onClick={() => navigate(`/planning/tasks/new?date=${formatIsoDate(startOfDay(date))}`)}
                        >
                          {DICTIONARY.tasks.details.create_and_assign}
                        </Button>
                      ) : null}
                    </CardBody>
                  </Card>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
