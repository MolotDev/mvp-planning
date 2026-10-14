import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ReportDocument } from "@/components/reports/ReportDocument";
import { reportStatusBadgeStyle } from "@/components/reports/reportStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GoBackIconButton } from "@/components/ui/icon-buttons";
import { Modal } from "@/components/ui/modal";
import { DICTIONARY } from "@/constants/dictionary";
import { canAdminister, homePath, reportInScope } from "@/lib/access";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { formatReportDate } from "@/lib/reportFormat";
import { isReportLockedByConfirmation } from "@/lib/missionConfirmation";
import { isReportSubmittable } from "@/lib/reportValidation";
import { notifySuccess } from "@/lib/toasts";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useReportStore } from "@/store/useReportStore";
import { useTargetStore } from "@/store/useTargetStore";
import { useTaskStore } from "@/store/useTaskStore";
import { detachmentName } from "@/lib/detachments";

export function ReportPreviewPage() {
  const { reportId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const report = useReportStore((state) => state.reports.find((item) => item.id === reportId));
  const syncDraftLinks = useReportStore((state) => state.syncDraftLinks);
  const clearReport = useReportStore((state) => state.clearReport);
  const submitReport = useReportStore((state) => state.submitReport);
  const missions = useMissionStore((state) => state.missions);
  const tasks = useTaskStore((state) => state.tasks);
  const targets = useTargetStore((state) => state.targets);
  const battleGroups = useBattleGroupStore((state) => state.battleGroups);
  const launches = useLaunchStore((state) => state.launches);
  const role = useAuthStore((state) => state.role);
  const entityId = useAuthStore((state) => state.entityId);
  const managesReports = canAdminister(role, "reports");
  const [editMode, setEditMode] = useState(() => searchParams.get("mode") === "edit");
  const [confirm, setConfirm] = useState<"clear" | "submit" | null>(null);

  useEffect(() => {
    setEditMode(searchParams.get("mode") === "edit");
  }, [reportId, searchParams]);

  const trajectoryNames = launches.map((launch) => `${launch.id}:${launch.trajectory_name ?? ""}`).join("|");

  useEffect(() => {
    if (reportId) {
      syncDraftLinks(reportId);
    }
  }, [reportId, launches.length, trajectoryNames, battleGroups.length, syncDraftLinks]);

  const snapshot = useMemo(
    () => ({ missions, tasks, targets, battleGroups, launches }),
    [missions, tasks, targets, battleGroups, launches],
  );

  if (report && !reportInScope(report, role, entityId)) {
    return <Navigate to={homePath(role)} replace />;
  }

  if (!report) {
    return (
      <section className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-2">
          <GoBackIconButton onClick={() => navigate("/reports")} />
          <h1 className="text-xl font-semibold">{DICTIONARY.reports.not_found}</h1>
        </div>
      </section>
    );
  }

  const locked =
    report.archived_at !== null ||
    report.status === "archived" ||
    isReportLockedByConfirmation(report, missions, tasks);
  const editing = managesReports && editMode && !locked;
  const canSubmit = isReportSubmittable(report, snapshot);
  const statusLabel =
    report.status === "submitted"
      ? DICTIONARY.reports.statuses.submitted
      : report.status === "archived"
        ? DICTIONARY.reports.statuses.archived
        : DICTIONARY.reports.statuses.draft;
  const title = fillTemplate(DICTIONARY.reports.title_template, {
    detachment: detachmentName(report.organization_id),
    date: formatReportDate(report.report_date),
  });

  const confirmClear = () => {
    clearReport(report.id);
    setConfirm(null);
    notifySuccess(DICTIONARY.reports.toasts.cleared);
  };

  const confirmSubmit = () => {
    const submitted = submitReport(report.id);
    setConfirm(null);
    setEditMode(false);
    if (submitted) {
      notifySuccess(DICTIONARY.reports.toasts.submitted);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <GoBackIconButton onClick={() => navigate("/reports")} />
          <h1 className="truncate text-lg font-semibold text-primitive-neutral-0" title={title}>
            {title}
          </h1>
          <Badge style={reportStatusBadgeStyle(report.status)}>
            {statusLabel}
          </Badge>
        </div>
        {managesReports && !locked && (
          <div className="flex flex-wrap items-center gap-3">
            {report.status === "draft" ? (
              <Button disabled={!canSubmit} onClick={() => setConfirm("submit")}>
                {DICTIONARY.reports.submit_report}
              </Button>
            ) : null}
            <div className="flex items-center gap-2 text-sm text-primitive-neutral-200">
              <span id="report-edit-mode-label">{DICTIONARY.reports.toggle_edit}</span>
              <button
                type="button"
                role="switch"
                aria-checked={editing}
                aria-labelledby="report-edit-mode-label"
                disabled={locked}
                onClick={() => setEditMode((current) => !current)}
                className={cn(
                  "relative h-6 w-11 rounded-full hover:cursor-pointer hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50",
                  editing ? "bg-primitive-blue-500" : "bg-primitive-neutral-700",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-primitive-neutral-0 transition-transform",
                    editing ? "left-5" : "left-0.5",
                  )}
                />
              </button>
            </div>
          </div>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ReportDocument
          locked={locked}
          report={report}
          snapshot={snapshot}
          readOnly={!editing}
          canSubmit={canSubmit}
          onClear={() => setConfirm("clear")}
          onSubmit={() => setConfirm("submit")}
        />
      </div>
      {confirm === "clear" ? (
        <Modal
          title={DICTIONARY.reports.modals.clear_confirm.title}
          onClose={() => setConfirm(null)}
          onConfirm={confirmClear}
          confirmLabel={DICTIONARY.reports.modals.clear_confirm.confirm_button}
          cancelLabel={DICTIONARY.reports.modals.clear_confirm.cancel_button}
        >
          <p className="text-sm text-primitive-neutral-200">{DICTIONARY.reports.modals.clear_confirm.message}</p>
        </Modal>
      ) : null}
      {confirm === "submit" ? (
        <Modal
          title={DICTIONARY.reports.modals.submit_confirm.title}
          onClose={() => setConfirm(null)}
          onConfirm={confirmSubmit}
          confirmLabel={DICTIONARY.reports.modals.submit_confirm.confirm_button}
          cancelLabel={DICTIONARY.reports.modals.submit_confirm.cancel_button}
        >
          <p className="text-sm text-primitive-neutral-200">{DICTIONARY.reports.modals.submit_confirm.message}</p>
        </Modal>
      ) : null}
    </section>
  );
}
