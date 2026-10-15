import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MissionForm } from "@/components/missions/MissionForm";
// import { type TaskGroupMode } from "@/components/missions/MissionProgressPanel";
import { Button } from "@/components/ui/button";
import { GoBackIconButton } from "@/components/ui/icon-buttons";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { entityStatusBadgeStyle } from "@/components/reports/reportStatusBadge";
import { DICTIONARY } from "@/constants/dictionary";
import { isScheduledBeforeCreated, startOfDay } from "@/lib/dates";
import { canAdminister } from "@/lib/access";
import { getEntityState } from "@/lib/entityState";
import { allMissionReportsSubmitted } from "@/lib/missionConfirmation";
import {
  draftsFromMission,
  getDateError,
  getScheduledIso,
  hasIncompleteAssignment,
  // linkedTasksForMission,
  toTaskDrafts,
  type TargetDraft,
} from "@/lib/missionForm";
import { notifyError, notifySuccess } from "@/lib/toasts";
// import { cn } from "@/lib/utils";
// import { LaunchProgressBadge } from "@/components/tasks/LaunchProgressBadge";
// import { useLaunchStore } from "@/store/useLaunchStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useReportStore } from "@/store/useReportStore";
import { useTaskStore } from "@/store/useTaskStore";
import { useTargetStore } from "@/store/useTargetStore";
// import { fillTemplate, remainingTaskAssets } from "@/lib/battleGroupCapacity";
// import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";

export function MissionPreviewPage() {
  const { missionId = "" } = useParams();
  const navigate = useNavigate();
  const mission = useMissionStore((state) => state.missions.find((item) => item.id === missionId));
  const tasks = useTaskStore((state) => state.tasks);
  // const launches = useLaunchStore((state) => state.launches);
  const targets = useTargetStore((state) => state.targets);
  // const battleGroups = useBattleGroupStore((state) => state.battleGroups);
  const aimingPoints = useTargetStore((state) => state.aimingPoints);
  const updateMission = useMissionStore((state) => state.updateMission);
  const role = useAuthStore((state) => state.role);
  const managesMissions = canAdminister(role, "missions");
  const confirmMission = useMissionStore((state) => state.confirmMission);
  const unlockMissionReports = useMissionStore((state) => state.unlockMissionReports);
  const reports = useReportStore((state) => state.reports);
  // const [isEditMode, setIsEditMode] = useState(true);
  const [approvalModal, setApprovalModal] = useState<"confirm" | "unlock" | null>(null);
  // const [groupMode, setGroupMode] = useState<TaskGroupMode>("target");
  const [scheduledAt, setScheduledAt] = useState<Date | null>(() =>
    mission ? startOfDay(new Date(mission.scheduled_at)) : null,
  );
  const [name, setName] = useState(() => mission?.name ?? "");
  const [description, setDescription] = useState(() => mission?.description ?? "");
  const [targetDrafts, setTargetDrafts] = useState<TargetDraft[]>(() =>
    mission ? draftsFromMission(mission, tasks) : [],
  );

  // const linkedTasks = useMemo(() => {
  //   if (!mission) {
  //     return [];
  //   }
  //   return linkedTasksForMission(mission, tasks);
  // }, [tasks, mission]);

  // const linkedGroups = useMemo(() => {
  //   return battleGroups.filter(
  //     (group) => linkedTasks.some(task => task.id === group.task_id),
  //   );
  // }, [battleGroups, linkedTasks]);

  useEffect(() => {
    const current = useMissionStore.getState().missions.find((item) => item.id === missionId);
    if (!current) {
      return;
    }
    // setIsEditMode(false);
    setScheduledAt(startOfDay(new Date(current.scheduled_at)));
    setName(current.name ?? "");
    setDescription(current.description);
    setTargetDrafts(draftsFromMission(current, useTaskStore.getState().tasks));
  }, [missionId]);

  const catalogTargets = useMemo(() => {
    const selectedIds = new Set(targetDrafts.map((draft) => draft.target_id));
    return targets.filter(
      (target) => target.archived_at === null || selectedIds.has(target.id),
    );
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
  // const planningLocked = isMissionPlanningLocked(mission, tasks, reports);
  const canConfirm = managesMissions && !isConfirmed && !isArchived && allMissionReportsSubmitted(mission, tasks, reports);
  // const editMode = isEditMode && !planningLocked;
  const title = mission.name ? `${mission.label} — ${mission.name}` : mission.label;
  const createdAt = mission.created_at;
  const scheduledIso = getScheduledIso(scheduledAt);
  const dateError = getDateError(scheduledIso, createdAt);
  const descriptionError = description.trim() ? null : DICTIONARY.targets_catalog.validation.required;
  const actionsEnabled =
    Boolean(scheduledIso) && !dateError && !descriptionError && !hasIncompleteAssignment(targetDrafts);

  const handleCancel = () => {
    setScheduledAt(startOfDay(new Date(mission.scheduled_at)));
    setName(mission.name ?? "");
    setDescription(mission.description);
    setTargetDrafts(draftsFromMission(mission, useTaskStore.getState().tasks));
    // setIsEditMode(false);
    // navigate("/planning/missions");
  };

  const handleSave = () => {
    if (!scheduledIso || !actionsEnabled) {
      return;
    }
    if (isScheduledBeforeCreated(scheduledIso, createdAt)) {
      notifyError(DICTIONARY.missions.toasts.date_error);
      return;
    }
    updateMission(
      mission.id,
      {
        name: name.trim() ? name.trim() : null,
        scheduled_at: scheduledIso,
        description: description.trim(),
      },
      toTaskDrafts(targetDrafts),
    );
    notifySuccess(DICTIONARY.missions.toasts.updated);
    // setIsEditMode(false);
    const updated = useMissionStore.getState().missions.find((item) => item.id === mission.id);
    if (updated) {
      setTargetDrafts(draftsFromMission(updated, useTaskStore.getState().tasks));
    }
  };
  // const remaining = remainingTaskAssets(linkedTasks.flatMap((task) => task.assets), linkedGroups);

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <GoBackIconButton onClick={() => navigate("/planning/missions")} />
          {isConfirmed ? (
            <Badge style={entityStatusBadgeStyle("reported")}>
              {`${DICTIONARY.common.states.reported} + ${DICTIONARY.common.statuses.confirmed}`}
            </Badge>
          ) : (
            <EntityStatusBadge status={entityState} />
          )}
          <h4 className="truncate text-lg font-semibold text-primitive-neutral-0" title={title}>
            {title}
          </h4>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canConfirm ? (
            <Button onClick={() => setApprovalModal("confirm")}>{DICTIONARY.common.actions.confirm_execution}</Button>
          ) : null}
          {managesMissions && isConfirmed ? (
            <Button variant="ghost" onClick={() => setApprovalModal("unlock")}>
              {DICTIONARY.common.actions.allow_report_edit}
            </Button>
          ) : null}
          {/* {canToggleEdit ? (
          <div className="flex items-center gap-2 text-sm text-primitive-neutral-200">
            <span id="mission-edit-mode-label">{DICTIONARY.missions.edit_toggle}</span>
            <button
              type="button"
              role="switch"
              aria-checked={editMode}
              aria-labelledby="mission-edit-mode-label"
              disabled={isArchived}
              onClick={() => {
                if (!canToggleEdit) {
                  return;
                }
                setIsEditMode((current) => !current);
              }}
              className={cn(
                "relative h-6 w-11 rounded-full hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
                editMode
                  ? "bg-primitive-blue-500 hover:bg-primitive-blue-500/90"
                  : "bg-primitive-neutral-700 hover:bg-primitive-neutral-600",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-primitive-neutral-0 transition-transform",
                  editMode ? "left-5" : "left-0.5",
                )}
              />
            </button>
          </div>
          ) : null} */}
        </div>
      </header>
      <div className="w-full max-w-4xl mx-auto flex-1 gap-4 overflow-hidden"> {/* lg:grid-cols-2 */}
        <div className="h-full flex flex-col overflow-y-auto rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 p-4">
          <MissionForm
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
          <div className="mt-4 flex justify-end gap-3 mt-auto">
            <Button variant="ghost" onClick={handleCancel}>
              {DICTIONARY.common.actions.cancel}
            </Button>
            <Button disabled={!actionsEnabled} onClick={handleSave}>
              {DICTIONARY.missions.buttons.save_mission}
            </Button>
          </div>
        </div>
        {/* <MissionProgressPanel
          tasks={linkedTasks}
          targets={targets}
          battleGroups={linkedGroups}
          launches={launches.filter((launch) => linkedTasks.some((task) => task.id === launch.task_id))}
          groupMode={groupMode}
          onGroupModeChange={setGroupMode}
        /> */}
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
    </section>
  );
}
