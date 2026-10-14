import { formatIsoDate, parseIsoDate } from "@/lib/dates";
import { sameDetachment } from "@/lib/detachments";
import { aggregateDay, type PlanningSnapshot } from "@/lib/reportAggregation";
import {
  DEFAULT_REPORT_FILTERS,
  type ReportFilterState,
} from "@/store/useReportFilterStore";
import type { Report, ReportListMetrics, ReportStatusFilter } from "@/types/report";

const STATUSES: ReportStatusFilter[] = ["draft", "submitted", "archived", "all"];

function parseStatus(value: string | null): ReportStatusFilter {
  if (value && STATUSES.includes(value as ReportStatusFilter)) {
    return value as ReportStatusFilter;
  }
  return DEFAULT_REPORT_FILTERS.status;
}

function parseDateParam(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return value;
}

export function hasReportFilterParams(params: URLSearchParams): boolean {
  return params.has("q") || params.has("date") || params.has("status") || params.has("detachment");
}

export function reportFiltersFromSearchParams(params: URLSearchParams): ReportFilterState | null {
  if (!hasReportFilterParams(params)) {
    return null;
  }
  return {
    query: params.get("q") ?? "",
    status: parseStatus(params.get("status")),
    reportDate: parseDateParam(params.get("date")),
    organizationId: params.get("detachment") ?? "",
  };
}

export function reportFiltersToSearchParams(filters: ReportFilterState): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.query) {
    params.q = filters.query;
  }
  if (filters.reportDate) {
    params.date = filters.reportDate;
  }
  if (filters.status !== DEFAULT_REPORT_FILTERS.status) {
    params.status = filters.status;
  }
  if (filters.organizationId) {
    params.detachment = filters.organizationId;
  }
  return params;
}

export function sameReportFilters(left: ReportFilterState, right: ReportFilterState): boolean {
  return (
    left.query === right.query &&
    left.status === right.status &&
    left.reportDate === right.reportDate &&
    left.organizationId === right.organizationId
  );
}

export function reportFilterDate(filters: ReportFilterState): Date | null {
  return filters.reportDate ? parseIsoDate(filters.reportDate) : null;
}

export function reportDateToParam(date: Date | null): string | null {
  return date ? formatIsoDate(date) : null;
}

export function reportListMetrics(reports: Report[]): ReportListMetrics {
  return {
    total: reports.length,
    submitted: reports.filter((report) => report.status === "submitted").length,
    draft: reports.filter((report) => report.status === "draft").length,
    archived: reports.filter((report) => report.status === "archived").length,
  };
}

export function filterReports(reports: Report[], filters: ReportFilterState, snapshot: PlanningSnapshot): Report[] {
  const query = filters.query.trim().toLowerCase();
  return reports
    .filter((report) => {
      if (filters.status !== "all" && report.status !== filters.status) {
        return false;
      }
      if (filters.reportDate && report.report_date !== filters.reportDate) {
        return false;
      }
      if (filters.organizationId && !sameDetachment(report.organization_id, filters.organizationId)) {
        return false;
      }
      if (!query) {
        return true;
      }
      if (report.organization_id.toLowerCase().includes(query)) {
        return true;
      }
      if ((report.commander_summary ?? "").toLowerCase().includes(query)) {
        return true;
      }
      const slice = aggregateDay(report.organization_id, report.report_date, snapshot);
      return slice.targets.some((target) => target.name.toLowerCase().includes(query));
    })
    .sort(
      (left, right) =>
        right.report_date.localeCompare(left.report_date) || right.updated_at.localeCompare(left.updated_at),
    );
}
