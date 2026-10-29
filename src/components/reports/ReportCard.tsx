import { MapPinned } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge, TargetIdBadge } from "@/components/ui/badge";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { ArchiveIconButton, EditIconButton, PreviewIconButton } from "@/components/ui/icon-buttons";
import { DICTIONARY } from "@/constants/dictionary";
import { canAdminister } from "@/lib/access";
import { formattingMGRS } from "@/lib/formattingMGRS";
import { isReportEditable } from "@/lib/missionConfirmation";
import { aggregateDay, deriveReportMetrics, type PlanningSnapshot } from "@/lib/reportAggregation";
import { reportStatusBadgeStyle } from "@/components/reports/reportStatusBadge";
import { formatReportDate } from "@/lib/reportFormat";
import { cn } from "@/lib/utils";
import type { Report } from "@/types/report";
import { detachmentName } from "@/lib/detachments";
import { useAuthStore } from "@/store/useAuthStore";

interface ReportCardProps {
  report: Report;
  snapshot: PlanningSnapshot;
  onArchive: (report: Report) => void;
}

export function ReportCard({ report, snapshot, onArchive }: ReportCardProps) {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);
  const managesReports = canAdminister(role, "reports");
  const slice = aggregateDay(report.organization_id, report.report_date, snapshot);
  const metrics = deriveReportMetrics(slice);
  const statusLabel =
    report.status === "submitted"
      ? DICTIONARY.reports.statuses.submitted
      : report.status === "archived"
        ? DICTIONARY.reports.statuses.archived
        : DICTIONARY.reports.statuses.draft;
  const summary = report.commander_summary ?? "";

  const reportEditable = isReportEditable(report, snapshot.missions, snapshot.tasks);
  const openReport = () => {
    const editable = managesReports && reportEditable ? "?mode=edit" : "";
    navigate(`/reports/${report.id}${editable}`);
  };

  return (
    <Card className={cn(report.status === "archived" ? "opacity-60" : "hover:cursor-pointer")} onClick={openReport}>
      <CardHeader>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-primitive-neutral-0" title={detachmentName(report.organization_id)}>
            {detachmentName(report.organization_id)}
          </p>
          <Badge className="bg-primitive-neutral-800 text-primitive-neutral-0">{formatReportDate(report.report_date)}</Badge>
          <Badge style={reportStatusBadgeStyle(report.status)}>
            {statusLabel}
          </Badge>
        </div>
        <div onClick={(event) => event.stopPropagation()}>
          {managesReports && reportEditable ? (
            <EditIconButton onClick={openReport} />
          ) : (
            <PreviewIconButton onClick={() => navigate(`/reports/${report.id}`)} />
          )}
        </div>
      </CardHeader>
      <CardBody className="gap-2">
        {slice.targets.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1 text-sm text-primitive-neutral-200">
              <MapPinned className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{DICTIONARY.reports.metrics.targets_title}:</span>
            </p>
            {slice.targets.map((target) => (
              <p key={target.id} className="flex flex-wrap items-center gap-2 text-sm" title={`${target.displayed_id || target?.label || "—"} ${target.name}`}>
                <TargetIdBadge>{target.displayed_id || target?.label || "—"}</TargetIdBadge>
                <span className="line-clamp-2">{target.name}</span>
                <Badge className="bg-primitive-neutral-800 text-primitive-neutral-0">
                  {formattingMGRS.spacing(target.mgrs)}
                </Badge>
              </p>
            ))}
          </div>
        ) : null}
        <p className="text-sm text-primitive-neutral-200">
          {`${DICTIONARY.reports.metrics.successful_launches}: ${metrics.successful_launches_count} (${metrics.success_rate}%)`}
        </p>
        <p className="text-sm text-primitive-neutral-200">
          {`${DICTIONARY.reports.metrics.failed_launches}: ${metrics.failed_launches_count} (${metrics.fail_rate}%)`}
        </p>
        <p className="text-sm text-primitive-neutral-200">
          {`${DICTIONARY.reports.metrics.cancelled_launches}: ${metrics.cancelled_launches_count}`}
        </p>
        {summary ? (
          <p className="line-clamp-2 text-sm text-primitive-neutral-300" title={summary}>
            {summary}
          </p>
        ) : null}
      </CardBody>
      <CardFooter>
        <div onClick={(event) => event.stopPropagation()}>
          {report.status !== "draft" || !managesReports ? null : <ArchiveIconButton onClick={() => onArchive(report)} />}
        </div>
      </CardFooter>
    </Card>
  );
}
