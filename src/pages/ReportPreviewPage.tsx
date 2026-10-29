import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ExecutionHeader } from "@/components/layout/ExecutionHeader";
import { CancelMissionModal } from "@/components/missions/CancelMissionModal";
import { ReportDocument } from "@/components/reports/ReportDocument";
import { Button } from "@/components/ui/button";
import { GoBackIconButton } from "@/components/ui/icon-buttons";
import { Modal } from "@/components/ui/modal";
import { DICTIONARY } from "@/constants/dictionary";
import { canAccess, canAdminister, homePath, reportInScope } from "@/lib/access";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { cancelReportDayExecution } from "@/lib/cancelExecution";
import { detachmentName } from "@/lib/detachments";
import { reportExecutionBadge } from "@/lib/executionBadge";
import { canShowCancelAction } from "@/lib/missionCancellation";
import { isReportEditable } from "@/lib/missionConfirmation";
import { formatReportDate } from "@/lib/reportFormat";
import { isReportSubmittable } from "@/lib/reportValidation";
import { notifyError, notifySuccess } from "@/lib/toasts";
import { submitDetachmentReport, type CheckpointDraftInput } from "@/services/reportSyncService";
import { useAuthStore } from "@/store/useAuthStore";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useReportStore } from "@/store/useReportStore";
import { useTargetStore } from "@/store/useTargetStore";
import { useTaskStore } from "@/store/useTaskStore";

export function ReportPreviewPage() {
  const { reportId = "" } = useParams();
  const navigate = useNavigate();
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
  const [confirm, setConfirm] = useState<"clear" | "submit" | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const checkpointDraftsRef = useRef<CheckpointDraftInput[]>([]);
  const rememberCheckpointDrafts = useCallback((rows: CheckpointDraftInput[]) => {
    checkpointDraftsRef.current = rows;
  }, []);

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
          <GoBackIconButton onClick={() => navigate(-1)} />
          <h1 className="text-xl font-semibold">{DICTIONARY.reports.not_found}</h1>
        </div>
      </section>
    );
  }

  const dayTasks = tasks.filter(
    (task) =>
      task.organization_id === report.organization_id &&
      task.scheduled_at &&
      task.scheduled_at.slice(0, 10) === report.report_date,
  );
  const cancelledBeforeExit = dayTasks.length > 0 && dayTasks.every(
    (task) => task.cancellation?.outcome === "cancelled_before_exit",
  );
  const contentEditable = isReportEditable(report, missions, tasks) && !cancelledBeforeExit;
  const locked = !contentEditable;
  const editing = managesReports && contentEditable;
  const canSubmit =
    editing && isReportSubmittable(report, snapshot) && canAccess(role, "reports");
  const badge = reportExecutionBadge(report, dayTasks);
  const label = dayTasks[0]?.label ?? report.report_date;
  const title = fillTemplate(DICTIONARY.reports.title_full, {
    label,
    detachment: detachmentName(report.organization_id),
    date: formatReportDate(report.report_date),
  });
  const showCancel =
    managesReports &&
    report.status === "draft" &&
    contentEditable &&
    dayTasks.some((task) => canShowCancelAction(task));

  const confirmClear = () => {
    clearReport(report.id);
    setConfirm(null);
    notifySuccess(DICTIONARY.reports.toasts.cleared);
  };

  const confirmSubmit = async () => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    const published = await submitDetachmentReport(report.id, checkpointDraftsRef.current);
    setIsSubmitting(false);
    if (!published.ok) {
      notifyError(DICTIONARY.reports.toasts.publish_failed);
      return;
    }
    const submitted = submitReport(report.id);
    if (!submitted) {
      notifyError(DICTIONARY.common.error);
      return;
    }
    setConfirm(null);
    notifySuccess(DICTIONARY.reports.toasts.submitted);
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <ExecutionHeader
        onBack={() => navigate(-1)}
        badge={badge}
        title={title}
        showCancel={showCancel}
        onCancelClick={() => setCancelOpen(true)}
        rightActions={
          editing ? (
            <Button disabled={!canSubmit} onClick={() => setConfirm("submit")}>
              {DICTIONARY.reports.submit_report}
            </Button>
          ) : null
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ReportDocument
          locked={locked}
          report={report}
          snapshot={snapshot}
          readOnly={!editing}
          canSubmit={canSubmit}
          onClear={() => setConfirm("clear")}
          onSubmit={() => setConfirm("submit")}
          onCheckpointDraftsChange={rememberCheckpointDrafts}
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
          onConfirm={() => void confirmSubmit()}
          confirmDisabled={isSubmitting}
          confirmLabel={
            isSubmitting
              ? DICTIONARY.reports.modals.submit_confirm.submitting
              : DICTIONARY.reports.modals.submit_confirm.confirm_button
          }
          cancelLabel={DICTIONARY.reports.modals.submit_confirm.cancel_button}
        >
          <p className="text-sm text-primitive-neutral-200">{DICTIONARY.reports.modals.submit_confirm.message}</p>
        </Modal>
      ) : null}
      {cancelOpen ? (
        <CancelMissionModal
          role={role === "CENTER" ? "CENTER" : "DETACHMENT"}
          onClose={() => setCancelOpen(false)}
          onConfirm={({ cancelTime, reason }) => {
            const result = cancelReportDayExecution(report.id, {
              cancelTime,
              reason,
              role: role === "CENTER" ? "CENTER" : "DETACHMENT",
            });
            setCancelOpen(false);
            if (!result) {
              notifyError(DICTIONARY.common.error);
              return;
            }
            notifySuccess(DICTIONARY.common.cancellation.success);
            if (result.outcome === "cancelled_before_exit") {
              navigate("/planning/tasks");
            }
          }}
        />
      ) : null}
    </section>
  );
}
