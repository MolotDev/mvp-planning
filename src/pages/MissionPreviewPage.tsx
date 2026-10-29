import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CrosshairIcon, MapPinned, PanelRightClose, PanelRightOpen, PlaneIcon, Users, X } from "lucide-react";
import { MissionAllocationBoard } from "@/components/missions/MissionAllocationBoard";
import { MissionAnalyticsColumn } from "@/components/missions/MissionAnalyticsColumn";
import { MissionReadinessPanel } from "@/components/missions/MissionReadinessPanel";
import { ExecutionHeader } from "@/components/layout/ExecutionHeader";
import { CancelMissionModal } from "@/components/missions/CancelMissionModal";
import { Button } from "@/components/ui/button";
import { GoBackIconButton } from "@/components/ui/icon-buttons";
import { Modal } from "@/components/ui/modal";
import { DICTIONARY } from "@/constants/dictionary";
import { canAdminister } from "@/lib/access";
import { cancelMissionExecution } from "@/lib/cancelExecution";
import { formatDateUk, isScheduledBeforeCreated, startOfDay } from "@/lib/dates";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { entityExecutionBadge } from "@/lib/executionBadge";
import { getEntityState } from "@/lib/entityState";
import { canShowCancelAction } from "@/lib/missionCancellation";
import { allMissionReportsSubmitted, isMissionPlanningLocked } from "@/lib/missionConfirmation";
import {
  draftsFromMission,
  getDateError,
  getScheduledIso,
  hasIncompleteAssignment,
  toTaskDrafts,
  type TargetDraft,
} from "@/lib/missionForm";
import { splitMissionsByTarget } from "@/lib/missionView";
import { notifyError, notifySuccess } from "@/lib/toasts";
import { useAuthStore } from "@/store/useAuthStore";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useReportStore } from "@/store/useReportStore";
import { useTaskStore } from "@/store/useTaskStore";
import { useTargetStore } from "@/store/useTargetStore";
import { MissionForm } from "@/components/missions/MissionForm";

export function MissionPreviewPage() {
  const { missionId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const focusTargetId = searchParams.get("targetId") ?? "";
  const navigate = useNavigate();
  const mission = useMissionStore((state) => state.missions.find((item) => item.id === missionId));
  const tasks = useTaskStore((state) => state.tasks);
  const launches = useLaunchStore((state) => state.launches);
  const targets = useTargetStore((state) => state.targets);
  const battleGroups = useBattleGroupStore((state) => state.battleGroups);
  const aimingPoints = useTargetStore((state) => state.aimingPoints);
  const updateMission = useMissionStore((state) => state.updateMission);
  const role = useAuthStore((state) => state.role);
  const managesMissions = canAdminister(role, "missions");
  const confirmMission = useMissionStore((state) => state.confirmMission);
  const unlockMissionReports = useMissionStore((state) => state.unlockMissionReports);
  const reports = useReportStore((state) => state.reports);
  const [approvalModal, setApprovalModal] = useState<"confirm" | "unlock" | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [didChange, setDidChange] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(() =>
    mission ? startOfDay(new Date(mission.scheduled_at)) : null,
  );
  const [name, setName] = useState(() => mission?.name ?? "");
  const [description, setDescription] = useState(() => mission?.description ?? "");
  const [targetDrafts, setTargetDrafts] = useState<TargetDraft[]>(() =>
    mission ? draftsFromMission(mission, tasks) : [],
  );

  useEffect(() => {
    if (editing) {
      return;
    }
    const current = useMissionStore.getState().missions.find((item) => item.id === missionId);
    if (!current) {
      return;
    }
    setScheduledAt(startOfDay(new Date(current.scheduled_at)));
    setName(current.name ?? "");
    setDescription(current.description);
    setTargetDrafts(draftsFromMission(current, useTaskStore.getState().tasks));
    setDidChange(false);
  }, [editing, mission?.updated_at, missionId, tasks]);

  const catalogTargets = useMemo(() => {
    const selectedIds = new Set(targetDrafts.map((draft) => draft.target_id));
    return targets.filter((target) => target.archived_at === null || selectedIds.has(target.id));
  }, [targets, targetDrafts]);

  if (!mission) {
    return (
      <section className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-2">
          <GoBackIconButton onClick={() => navigate("/planning/missions")} />
          <h1 className="text-xl font-semibold">{DICTIONARY.missions.not_found}</h1>
        </div>
      </section>
    );
  }

  const entityState = getEntityState(mission);
  const isConfirmed = mission.confirmed_at !== null;
  const isArchived = entityState === "archived";
  const planningLocked = isMissionPlanningLocked(mission, tasks, reports);
  const canEdit = managesMissions && !planningLocked && !isArchived;
  const canConfirm = managesMissions && !isConfirmed && !isArchived && allMissionReportsSubmitted(mission, tasks, reports);
  const focusCard = focusTargetId
    ? splitMissionsByTarget([mission], tasks, targets).find((card) => card.targetId === focusTargetId)
    : undefined;
  const title = focusCard?.title ?? (mission.name ? `${mission.label} — ${mission.name}` : mission.label);
  const heading = focusCard?.label ?? mission.label;
  const executionBadge = entityExecutionBadge(mission);
  const headerTitle = fillTemplate(DICTIONARY.missions.command.title_full, {
    label: heading,
    date: formatDateUk(mission.scheduled_at),
  });
  const showCancel = managesMissions && canShowCancelAction(mission);
  const summaryDrafts = focusTargetId && !editing
    ? targetDrafts.filter((draft) => draft.target_id === focusTargetId)
    : targetDrafts;
  const scopedTasks = focusTargetId
    ? tasks.map((task) => ({
        ...task,
        allocations: task.allocations.filter(
          (line) => line.mission_id !== mission.id || line.target_id === focusTargetId,
        ),
      }))
    : tasks;
  const scheduledIso = getScheduledIso(scheduledAt);
  const dateError = getDateError(scheduledIso, mission.created_at);
  const descriptionError = description.trim() ? null : DICTIONARY.targets_catalog.validation.required;
  const actionsEnabled = Boolean(scheduledIso) && !dateError && !descriptionError && !hasIncompleteAssignment(targetDrafts);

  const resetDraft = () => {
    setScheduledAt(startOfDay(new Date(mission.scheduled_at)));
    setName(mission.name ?? "");
    setDescription(mission.description);
    setTargetDrafts(draftsFromMission(mission, useTaskStore.getState().tasks));
    setDidChange(false);
    setEditing(false);
  };

  const handleSave = () => {
    if (!scheduledIso || !actionsEnabled) {
      return;
    }
    if (isScheduledBeforeCreated(scheduledIso, mission.created_at)) {
      notifyError(DICTIONARY.missions.toasts.date_error);
      return;
    }
    const updated = updateMission(
      mission.id,
      {
        name: name.trim() ? name.trim() : null,
        scheduled_at: scheduledIso,
        description: description.trim(),
      },
      toTaskDrafts(targetDrafts),
    );
    if (!updated) {
      notifyError(DICTIONARY.common.error);
      return;
    }
    notifySuccess(DICTIONARY.missions.toasts.updated);
    setEditing(false);
    setDidChange(false);
  };

  const assetQuantity = summaryDrafts.flatMap(item => item.detachments).reduce((sum, item) => sum += Number(item.quantity), 0);
  const detachmentQuantity = (new Set(summaryDrafts.flatMap(item => item.detachments).map(item=> item.organization_id))).size;
  const assignedTasks = new Set(summaryDrafts.flatMap(item => item.detachments).map(item=> item.task_id));
  const crewQuantity = (new Set(battleGroups.filter(item => assignedTasks.has(item.allocation_line_id ?? "")).flatMap(item=> item.lead_crew_id))).size;
  
  const [statsOpen, setStatsOpen] = useState(false);

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <ExecutionHeader
        onBack={() => navigate(-1)}
        badge={executionBadge}
        title={headerTitle}
        titleTitle={title}
        showCancel={showCancel}
        onCancelClick={() => setCancelOpen(true)}
        rightActions={
          <>
            {canEdit && !editing ? (
              <Button variant="ghost" onClick={() => setEditing(true)}>
                {DICTIONARY.missions.edit_toggle}
              </Button>
            ) : null}
            {canConfirm ? (
              <Button onClick={() => setApprovalModal("confirm")}>{DICTIONARY.common.actions.confirm_execution}</Button>
            ) : null}
            {managesMissions && isConfirmed ? (
              <Button variant="ghost" onClick={() => setApprovalModal("unlock")}>
                {DICTIONARY.common.actions.allow_report_edit}
              </Button>
            ) : null}
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden justify-between">
        <div className="h-full w-[60%] space-y-2 overflow-y-auto overflow-x-hidden pr-2">
          <div className="flex flex-col rounded-md bg-primitive-neutral-900 p-4">
            <article className="w-full flex justify-between border-b border-primitive-neutral-700 mb-4">
              <div className="flex gap-2 items-center justify-center py-1 px-3">
                <MapPinned className="h-4 w-4 shrink-0 text-sky-300/50" aria-hidden="true" />
                <p className="truncate text-sm font-semibold text-zinc-300">
                  {`${summaryDrafts.length} цілі`}
                </p>
              </div>
              <div className="border-l border-primitive-neutral-700" />
              <div className="flex gap-2 items-center justify-center py-1 px-3">
                <CrosshairIcon className="h-4 w-4 shrink-0 text-sky-300/50" aria-hidden="true" />
                <p className="truncate text-sm font-semibold text-zinc-300">
                  {`${summaryDrafts.flatMap(item=> item.aiming_point_ids).length} точ. приц.`}
                </p>
              </div>
              <div className="border-l border-primitive-neutral-700" />
              <div className="flex gap-2 items-center justify-center py-1 px-3">
                <PlaneIcon className="h-4 w-4 shrink-0 text-sky-300/50" aria-hidden="true" />
                <p className="truncate text-sm font-semibold text-zinc-300">
                  {`${assetQuantity} засоби`}
                </p>
              </div>
              <div className="border-l border-primitive-neutral-700" />
              <div className="flex gap-2 items-center justify-center py-1 px-3">
                <Users className="h-4 w-4 shrink-0 text-sky-300/50" aria-hidden="true" />
                <p className="truncate text-sm font-semibold text-zinc-300">
                  {`${detachmentQuantity} загони`}
                </p>
              </div>
              <div className="border-l border-primitive-neutral-700" />
              <div className="flex gap-2 items-center justify-center py-1 px-3">
                <Users className="h-4 w-4 shrink-0 text-sky-300/50" aria-hidden="true" />
                <p className="truncate text-sm font-semibold text-zinc-300">
                  {`${crewQuantity} екіпажі`}
                </p>
              </div>
            </article>
            {editing ? (
              <section className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" onClick={resetDraft}>
                      <X className="h-4 w-4" aria-hidden="true" />
                      {DICTIONARY.common.actions.cancel}
                    </Button>
                    <Button disabled={!actionsEnabled || !didChange} onClick={handleSave}>
                      {DICTIONARY.missions.buttons.save_mission}
                    </Button>
                  </div>
                </div>
                <MissionForm
                  missionId={mission.id}
                  setDidChange={setDidChange}
                  scheduledAt={scheduledAt}
                  name={name}
                  description={description}
                  targetDrafts={targetDrafts}
                  catalogTargets={catalogTargets}
                  aimingPoints={aimingPoints}
                  dateError={dateError ?? undefined}
                  descriptionError={descriptionError ?? undefined}
                  readOnly={false}
                  onScheduledAtChange={setScheduledAt}
                  onNameChange={setName}
                  onDescriptionChange={setDescription}
                  onTargetDraftsChange={setTargetDrafts}
                />
                {targetDrafts.length >= 2 ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button variant="ghost" onClick={resetDraft}>
                      <X className="h-4 w-4" aria-hidden="true" />
                      {DICTIONARY.common.actions.cancel}
                    </Button>
                    <Button disabled={!actionsEnabled || !didChange} onClick={handleSave}>
                      {DICTIONARY.missions.buttons.save_mission}
                    </Button>
                  </div>
                ) : null}
              </section>
            ) : (
              <>
                <MissionAllocationBoard
                  mission={mission}
                  tasks={editing ? tasks : scopedTasks}
                  launches={launches}
                  targets={targets}
                  aimingPoints={aimingPoints}
                  canEdit={canEdit}
                  onEdit={() => setEditing(true)}
                />
              </>
            )}
          </div>
        </div>
        <div className="relative flex h-full w-[40%] flex-col overflow-hidden bg-primitive-neutral-900/40">
          <div className="flex h-full flex-col gap-4 overflow-y-auto pl-2">
            <Button
              variant="ghost"
              className="h-10 w-full justify-between border border-primitive-neutral-700 bg-primitive-neutral-900 px-3"
              onClick={() => setStatsOpen(true)}
            >
              <span className="text-sm font-medium">Денна статистика загонів</span>
              <PanelRightOpen className="h-4 w-4 text-primitive-neutral-400" aria-hidden="true" />
            </Button>
            <MissionReadinessPanel
              mission={mission}
              tasks={scopedTasks}
              groups={battleGroups}
              launches={launches}
              targets={targets}
              aimingPoints={aimingPoints}
            />
          </div>
          {statsOpen ? (
            <div className="absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l border-primitive-neutral-800 bg-primitive-neutral-900 shadow-2xl" role="presentation">
              <aside
                role="dialog"
                aria-modal="true"
                aria-labelledby="task-info-title"
                className="relative px-2 z-10 mt-1 flex h-full w-full flex-col border-l border-primitive-neutral-800 bg-primitive-neutral-900 shadow-lg"
              >
                <header className="flex items-center justify-between gap-3 mb-2">
                  <h2 id="task-info-title" className="text-base font-semibold text-primitive-neutral-0">
                    Денна статистика загонів
                  </h2>
                  <Button
                    variant="ghost"
                    className="h-8 w-8 rounded-full px-0"
                    title="Закрити статистику загонів"
                    aria-label="Закрити статистику загонів"
                    onClick={() => setStatsOpen(false)}
                  >
                    <PanelRightClose className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </header>
                <MissionAnalyticsColumn mission={mission} tasks={scopedTasks} groups={battleGroups} launches={launches} />
              </aside>
            </div>
          ) : null}
        </div>
      </div>
      {approvalModal === "confirm" ? (
        <Modal
          title={DICTIONARY.missions.modals.confirm_execution.title}
          onClose={() => setApprovalModal(null)}
          onConfirm={() => {
            if (confirmMission(mission.id)) {
              notifySuccess(DICTIONARY.missions.toasts.confirmed);
            }
            setApprovalModal(null);
          }}
          confirmLabel={DICTIONARY.missions.modals.confirm_execution.confirm_button}
          cancelLabel={DICTIONARY.missions.modals.confirm_execution.cancel_button}
        >
          <p className="text-sm text-primitive-neutral-200">{DICTIONARY.missions.modals.confirm_execution.message}</p>
        </Modal>
      ) : null}
      {approvalModal === "unlock" ? (
        <Modal
          title={DICTIONARY.missions.modals.unlock_reports.title}
          onClose={() => setApprovalModal(null)}
          onConfirm={() => {
            if (unlockMissionReports(mission.id)) {
              notifySuccess(DICTIONARY.missions.toasts.unlocked);
            }
            setApprovalModal(null);
          }}
          confirmLabel={DICTIONARY.missions.modals.unlock_reports.confirm_button}
          cancelLabel={DICTIONARY.missions.modals.unlock_reports.cancel_button}
        >
          <p className="text-sm text-primitive-neutral-200">{DICTIONARY.missions.modals.unlock_reports.message}</p>
        </Modal>
      ) : null}
      {cancelOpen ? (
        <CancelMissionModal
          role="CENTER"
          onClose={() => setCancelOpen(false)}
          onConfirm={({ cancelTime, reason }) => {
            const result = cancelMissionExecution(mission.id, {
              cancelTime,
              reason,
              role: "CENTER",
            });
            setCancelOpen(false);
            if (!result) {
              notifyError(DICTIONARY.common.error);
              return;
            }
            notifySuccess(DICTIONARY.common.cancellation.success);
            if (result.outcome === "cancelled_before_exit") {
              navigate("/planning/missions");
            }
          }}
        />
      ) : null}
    </section>
  );
}
