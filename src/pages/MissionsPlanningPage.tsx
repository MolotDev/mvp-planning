import { useEffect, useMemo, useState } from "react";
import { Calendar, LandPlot, Plus, Search, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CreateEditMissionModal } from "@/components/missions/CreateEditMissionModal";
import { MissionCard } from "@/components/missions/MissionCard";
import { Button } from "@/components/ui/button";
import { AppDateRangePicker } from "@/components/ui/date-picker";
import { HeaderMetricCards } from "@/components/ui/header-metric-cards";
import { Input } from "@/components/ui/input";
import { StatusFilterSelect } from "@/components/ui/status-filter-select";
import { DICTIONARY } from "@/constants/dictionary";
import { calculateDateOffset, convertDateToDdMmDayOfWeek, formatDateUk, formatIsoDate, getDaysArray, isLessThanOneDay, isMoreThanOneDay, isToday} from "@/lib/dates";
import { canAdminister } from "@/lib/access";
import {
  missionFilterRange,
  missionFiltersFromSearchParams,
  missionFiltersToSearchParams,
  sameMissionFilters,
} from "@/lib/missionFilters";
import { TRANSLATIONS } from "@/lib/translations";
import { useAuthStore } from "@/store/useAuthStore";
import { useMissionFilterStore, type MissionFilterState } from "@/store/useMissionFilterStore";
import { filterMissions, getMissionMetrics, useMissionStore } from "@/store/useMissionStore";
import { useTaskStore } from "@/store/useTaskStore";
import { useTargetStore } from "@/store/useTargetStore";
import type { Mission, MissionStatusFilter } from "@/types/mission";
import { ResetFiltersIconButton } from "@/components/ui/icon-buttons";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function MissionsPlanningPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMissionFilterStore((state) => state.filters);
  const setFilters = useMissionFilterStore((state) => state.setFilters);
  const resetFiltersState = useMissionFilterStore((state) => state.reset);
  const missions = useMissionStore((state) => state.missions);
  const tasks = useTaskStore((state) => state.tasks);
  const targets = useTargetStore((state) => state.targets);
  const role = useAuthStore((state) => state.role);
  const managesMissions = canAdminister(role, "missions");
  const aimingPoints = useTargetStore((state) => state.aimingPoints);
  const [modalMission, setModalMission] = useState<Mission | null | undefined>(undefined);

  useEffect(() => {
    const parsed = missionFiltersFromSearchParams(searchParams);
    if (!parsed) {
      return;
    }
    const current = useMissionFilterStore.getState().filters;
    if (!sameMissionFilters(current, parsed)) {
      setFilters(parsed);
    }
  }, [searchParams, setFilters]);
  useEffect(() => {
    if (filters.dateFrom === null) {
      const dateFrom = calculateDateOffset(new Date(), -2).split('T')[0];
      const dateTo = calculateDateOffset(new Date(), 2).split('T')[0];
      setFilters({ ...filters, dateFrom, dateTo });
    }
  }, [filters.dateFrom, filters.dateTo, setFilters]);

  const applyFilters = (next: MissionFilterState) => {
    setFilters(next);
    setSearchParams(missionFiltersToSearchParams(next), { replace: true });
  };

  const resetFilters = () => {
    resetFiltersState();
    setSearchParams({}, { replace: true });
  };

  const [from, to] = missionFilterRange(filters);

  const filteredMissions = useMemo(() => {
    return filterMissions(missions, tasks, targets, aimingPoints, filters.query, filters.status, from, to)
  }, [missions, tasks, targets, aimingPoints, filters.query, filters.status, from, to]);
  const visibleMissions = useMemo(
    () => {
      if (!from || !to) {
        return [];
      }
      const displayingData = getDaysArray(from?.toISOString() ?? "", to?.toISOString() ?? "").map(date => {
        return {
          date: date,
          mission: filteredMissions.find(mission => formatDateUk(mission.scheduled_at) === formatDateUk(date.toString())) ?? null,
        }
      });
      return displayingData;
    },
    [filteredMissions, from, to],
  );

  const metrics = useMemo(() => getMissionMetrics(filteredMissions), [filteredMissions]);
  const [planningDate, setPlanningDate] = useState<Date | null>(null);
  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <h1 className="sr-only">{TRANSLATIONS.missions}</h1>
      <HeaderMetricCards
        metrics={{
          total: metrics.total,
          completed: metrics.reported,
          active: metrics.active,
          archived: metrics.archived,
        }}
      />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <div className="w-full min-w-48 lg:w-48">
            <AppDateRangePicker
              startDate={from}
              endDate={to}
              onChange={(range) =>
                applyFilters({
                  ...filters,
                  dateFrom: range[0] ? formatIsoDate(range[0]) : null,
                  dateTo: range[1] ? formatIsoDate(range[1]) : null,
                })
              }
              placeholder={DICTIONARY.missions.date_range}
            />
          </div>
          <div className="relative min-w-0 flex-1 lg:max-w-60">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primitive-neutral-500"
              aria-hidden="true"
            />
            <Input
              value={filters.query}
              onChange={(event) => applyFilters({ ...filters, query: event.target.value })}
              placeholder={DICTIONARY.common.actions.search}
              className="pl-9 pr-9"
              aria-label={DICTIONARY.common.actions.search}
            />
            {filters.query ? (
              <button
                type="button"
                title={DICTIONARY.common.actions.clear}
                aria-label={DICTIONARY.common.actions.clear}
                onClick={() => applyFilters({ ...filters, query: "" })}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-primitive-neutral-300 hover:cursor-pointer hover:bg-primitive-neutral-850 hover:shadow-md"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div className="w-full min-w-0 lg:w-[120px]">
            <StatusFilterSelect
              value={filters.status}
              onChange={(value) => applyFilters({ ...filters, status: value as MissionStatusFilter })}
            />
          </div>
          <ResetFiltersIconButton onClick={resetFilters} />
        </div>
        {managesMissions ? (
          <Button onClick={() => setModalMission(null)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {DICTIONARY.missions.create_button}
          </Button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {visibleMissions.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Card className="w-full items-center gap-3 text-center justify-center">
              <LandPlot className="h-8 w-8 text-primitive-neutral-500" aria-hidden="true" />
              <p className="text-sm text-primitive-neutral-300">
                {DICTIONARY.missions.empty_state}
              </p>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-5">
            {visibleMissions.map(({date, mission}) => (
              <div className={cn(
                "w-full flex flex-col gap-0.5 opacity-70",
                isMoreThanOneDay(date) || isLessThanOneDay(date) ? "scale-[96%]" : "",
                isToday(date) ? "opacity-100 scale-[102%]" : ""
              )} key={`${date}-${mission?.id}`}>
                <div className="flex items-center gap-2">
                  <Badge className={cn(
                    "flex items-center bg-primitive-neutral-800 text-sm",
                    date.getDate() === new Date().getDate() ? "" : "bg-primitive-neutral-700"
                  )}>
                    <Calendar className="h-3 w-3 shrink-0 mr-1" aria-hidden="true" />
                    {convertDateToDdMmDayOfWeek(date)}
                  </Badge>
                  
                  <span className="text-sm">
                    {date.getDate() === new Date().getDate() ? "Сьогодні" : ""}
                  </span>
                </div>
                {mission ? (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    tasks={tasks}
                    targets={targets}
                    onPreview={(item) => navigate(`/planning/missions/${item.id}`)}
                  />
                ) : (
                  <Card className="min-h-60">
                    <CardBody className="gap-3 text-center justify-center">
                      <p className="text-sm text-primitive-neutral-300 opacity-60">
                        {DICTIONARY.missions.no_missions}
                      </p>
                      {managesMissions && date.getDate() > new Date().getDate() ? (
                        <Button variant="outline" onClick={() => {
                          setModalMission(null);
                          setPlanningDate(date);
                        }}>
                          {DICTIONARY.common.actions.create}
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
      {modalMission !== undefined ? (
        <CreateEditMissionModal mission={modalMission} planningDate={planningDate} onClose={() => {
          navigate(`/planning/missions`);
          setModalMission(undefined);
          setPlanningDate(null);
        }} />
      ) : null}
    </section>
  );
}
