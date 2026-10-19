import { useEffect, useMemo, useState } from "react";
import { FileBarChart, Plus, Search, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { CreateReportModal } from "@/components/reports/CreateReportModal";
import { ReportCard } from "@/components/reports/ReportCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AppDatePicker } from "@/components/ui/date-picker";
import { HeaderMetricCards } from "@/components/ui/header-metric-cards";
import { Input } from "@/components/ui/input";
import { StatusFilterSelect } from "@/components/ui/status-filter-select";
import { ResetFiltersIconButton } from "@/components/ui/icon-buttons";
import { DICTIONARY } from "@/constants/dictionary";
import { DETACHMENT_REFS } from "@/data/crews";
import { canAdminister, hidesDetachmentFilter, locksDetachmentFilter, reportInScope, withSessionScope } from "@/lib/access";
import { detachmentId } from "@/lib/detachments";
import {
  filterReports,
  reportFilterDate,
  reportDateToParam,
  reportFiltersFromSearchParams,
  reportFiltersToSearchParams,
  reportListMetrics,
  sameReportFilters,
} from "@/lib/reportFilters";
import { notifySuccess } from "@/lib/toasts";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useMissionStore } from "@/store/useMissionStore";
import { DEFAULT_REPORT_FILTERS, useReportFilterStore, type ReportFilterState } from "@/store/useReportFilterStore";
import { useReportStore } from "@/store/useReportStore";
import { useTargetStore } from "@/store/useTargetStore";
import { useTaskStore } from "@/store/useTaskStore";
import type { ReportStatusFilter } from "@/types/report";

export function ReportsPage() {
  const role = useAuthStore((state) => state.role);
  const entityId = useAuthStore((state) => state.entityId);
  const managesReports = canAdminister(role, "reports");
  const detachmentLocked = locksDetachmentFilter(role);
  const hideDetachment = hidesDetachmentFilter(role);
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useReportFilterStore((state) => state.filters);
  const setFilters = useReportFilterStore((state) => state.setFilters);
  const reports = useReportStore((state) => state.reports);
  const archiveReport = useReportStore((state) => state.archiveReport);
  const missions = useMissionStore((state) => state.missions);
  const tasks = useTaskStore((state) => state.tasks);
  const targets = useTargetStore((state) => state.targets);
  const battleGroups = useBattleGroupStore((state) => state.battleGroups);
  const launches = useLaunchStore((state) => state.launches);
  const [createOpen, setCreateOpen] = useState(false);

  const activeFilters = withSessionScope(filters, role, entityId);

  useEffect(() => {
    const parsed = reportFiltersFromSearchParams(searchParams);
    const current = useReportFilterStore.getState().filters;
    const next = withSessionScope(parsed ?? current, role, entityId);
    if (!sameReportFilters(current, next)) {
      setFilters(next);
    }
    if (role === "DETACHMENT" && entityId && searchParams.get("detachment") !== entityId) {
      setSearchParams(reportFiltersToSearchParams(next), { replace: true });
    }
  }, [searchParams, setFilters, setSearchParams, role, entityId]);

  const snapshot = useMemo(
    () => ({ missions, tasks, targets, battleGroups, launches }),
    [missions, tasks, targets, battleGroups, launches],
  );
  const visible = useMemo(
    () => filterReports(reports.filter((report) => reportInScope(report, role, entityId)), activeFilters, snapshot),
    [reports, activeFilters, snapshot, role, entityId],
  );
  const metrics = reportListMetrics(visible);

  const applyFilters = (next: ReportFilterState) => {
    const scoped = withSessionScope(next, role, entityId);
    setFilters(scoped);
    setSearchParams(reportFiltersToSearchParams(scoped), { replace: true });
  };

  const resetFilters = () => {
    const scoped = withSessionScope({ ...DEFAULT_REPORT_FILTERS }, role, entityId);
    setFilters(scoped);
    setSearchParams(reportFiltersToSearchParams(scoped), { replace: true });
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-4">
      <h1 className="sr-only">{DICTIONARY.reports.title}</h1>
      <HeaderMetricCards
        variant="reports"
        metrics={{
          total: metrics.total,
          completed: metrics.submitted,
          active: metrics.draft,
          archived: metrics.archived,
        }}
      />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <div className="w-full min-w-32 lg:w-32">
            <AppDatePicker
              selected={reportFilterDate(activeFilters)}
              onChange={(date) => applyFilters({ ...activeFilters, reportDate: reportDateToParam(date) })}
              placeholder={DICTIONARY.reports.date_filter}
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
              placeholder={DICTIONARY.reports.search}
              className="pl-9 pr-9"
              aria-label={DICTIONARY.reports.search}
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
          <div className="w-full min-w-0 lg:w-40">
            <select
              value={detachmentId(activeFilters.organizationId)}
              disabled={detachmentLocked}
              onChange={(event) => applyFilters({ ...activeFilters, organizationId: event.target.value })}
              aria-label={DICTIONARY.reports.modals.create.detachment_label}
              className={cn(
                "h-9 w-full rounded-md border border-primitive-neutral-700 bg-primitive-neutral-900 px-3 text-sm text-primitive-neutral-0 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <option value="">{DICTIONARY.missions.select_detachment}</option>
              {DETACHMENT_REFS.map((detachment) => (
                <option key={detachment.id} value={detachment.id}>
                  {detachment.name}
                </option>
              ))}
            </select>
          </div>
          )}
          <div className="w-full min-w-0 lg:w-[120px]">
            <StatusFilterSelect
              mode="report"
              value={activeFilters.status}
              onChange={(status) => applyFilters({ ...activeFilters, status: status as ReportStatusFilter })}
            />
          </div>
          <ResetFiltersIconButton onClick={resetFilters} />
        </div>
        {managesReports ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {DICTIONARY.reports.create_button}
          </Button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {visible.length === 0 ? (
          <div className="flex h-full w-full items-center">
            <Card className="w-full items-center gap-3 text-center justify-center">
              <FileBarChart className="h-8 w-8 text-primitive-neutral-500" aria-hidden="true" />
              <p className="text-sm text-primitive-neutral-300">{DICTIONARY.reports.empty}</p>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {visible.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                snapshot={snapshot}
                onArchive={(item) => {
                  if (archiveReport(item.id)) {
                    notifySuccess(DICTIONARY.reports.toasts.archived);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
      {createOpen ? <CreateReportModal onClose={() => setCreateOpen(false)} /> : null}
    </section>
  );
}
