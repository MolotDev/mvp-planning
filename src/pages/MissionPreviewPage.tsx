import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import { MissionAllocationBoard } from "@/components/missions/MissionAllocationBoard";
import { MissionAnalyticsColumn } from "@/components/missions/MissionAnalyticsColumn";
import { MissionLaunchMonitor } from "@/components/missions/MissionLaunchMonitor";
import { MissionReadinessPanel } from "@/components/missions/MissionReadinessPanel";
import { Button } from "@/components/ui/button";
import { GoBackIconButton } from "@/components/ui/icon-buttons";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { entityStatusBadgeStyle } from "@/components/reports/reportStatusBadge";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";
import { DICTIONARY } from "@/constants/dictionary";
import { canAdminister } from "@/lib/access";
import { isScheduledBeforeCreated, startOfDay } from "@/lib/dates";
import { getEntityState } from "@/lib/entityState";
import { allMissionReportsSubmitted, isMissionPlanningLocked } from "@/lib/missionConfirmation";
import {
  draftsFromMission,
  getDateError,
  getScheduledIso,
  hasIncompleteAssignment,
  toTaskDrafts,
  type TargetDraft,
} from "@/lib/missionForm";
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
  const title = mission.name ? `${mission.label} — ${mission.name}` : mission.label;
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
          <h2 className="truncate text-lg font-semibold text-primitive-neutral-0" title={title}>
            {mission.label}
          </h2>
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
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
        <div className="flex h-full w-[62%] flex-col space-y-6 overflow-y-auto border-r border-primitive-neutral-800 p-4">
          {editing ? (
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {/* <h4 className="text-lg font-semibold text-primitive-neutral-0">{mission.label}</h4> */}
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
                tasks={tasks}
                launches={launches}
                targets={targets}
                aimingPoints={aimingPoints}
                groups={battleGroups}
                canEdit={canEdit}
                onEdit={() => setEditing(true)}
              />
              <MissionReadinessPanel mission={mission} tasks={tasks} groups={battleGroups} launches={launches} />
              <MissionLaunchMonitor mission={mission} tasks={tasks} groups={battleGroups} launches={launches} />
            </>
          )}
        </div>
        <div className="h-full w-[38%] overflow-y-auto bg-primitive-neutral-900/40 p-4">
          <MissionAnalyticsColumn mission={mission} tasks={tasks} groups={battleGroups} launches={launches} />
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
    </section>
  );
}
