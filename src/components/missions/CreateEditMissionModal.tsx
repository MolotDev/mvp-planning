import { useMemo, useState } from "react";
import { MissionForm } from "@/components/missions/MissionForm";
import { Modal } from "@/components/ui/modal";
import { DICTIONARY } from "@/constants/dictionary";
import { isScheduledBeforeCreated, startOfDay } from "@/lib/dates";
import {
  draftsFromMission,
  getDateError,
  getScheduledIso,
  hasIncompleteAssignment,
  toTaskDrafts,
  type TargetDraft,
} from "@/lib/missionForm";
import { notifyError, notifySuccess } from "@/lib/toasts";
import { useMissionStore } from "@/store/useMissionStore";
import { useTaskStore } from "@/store/useTaskStore";
import { useTargetStore } from "@/store/useTargetStore";
import type { Mission } from "@/types/mission";

interface CreateEditMissionModalProps {
  mission?: Mission | null;
  onClose: () => void;
  planningDate?: Date | null;
}

export function CreateEditMissionModal({ mission, onClose, planningDate }: CreateEditMissionModalProps) {
  const isEdit = Boolean(mission);
  const targets = useTargetStore((state) => state.targets);
  const catalogTargets = useMemo(
    () => targets.filter((target) => target.archived_at === null),
    [targets],
  );
  const aimingPoints = useTargetStore((state) => state.aimingPoints);
  const allTasks = useTaskStore((state) => state.tasks);
  const missionsLength = useMissionStore((state) => state.missions.length);
  const createMission = useMissionStore((state) => state.createMission);
  const updateMission = useMissionStore((state) => state.updateMission);

  const [scheduledAt, setScheduledAt] = useState<Date | null>(
    mission ? startOfDay(new Date(mission.scheduled_at)) : planningDate ? startOfDay(planningDate) : null,
  );
  const [name, setName] = useState(mission?.name ?? "");
  const [description, setDescription] = useState(mission?.description ?? "");
  const [targetDrafts, setTargetDrafts] = useState<TargetDraft[]>(() =>
    mission ? draftsFromMission(mission, allTasks) : [],
  );

  const createdAt = mission?.created_at ?? new Date().toISOString();
  const scheduledIso = getScheduledIso(scheduledAt);
  const dateError = getDateError(scheduledIso, createdAt);
  const descriptionError = description.trim() ? null : DICTIONARY.targets_catalog.validation.required;
  const confirmDisabled =
    !scheduledIso || Boolean(descriptionError) || hasIncompleteAssignment(targetDrafts);

  const handleSave = () => {
    if (!scheduledIso) {
      return;
    }
    if (isScheduledBeforeCreated(scheduledIso, createdAt)) {
      notifyError(DICTIONARY.missions.toasts.date_error);
      return;
    }
    if (descriptionError || hasIncompleteAssignment(targetDrafts)) {
      return;
    }
    const input = {
      name: name.trim() ? name.trim() : null,
      scheduled_at: scheduledIso,
      description: description.trim(),
    };
    const drafts = toTaskDrafts(targetDrafts);
    if (mission) {
      updateMission(mission.id, input, drafts);
      notifySuccess(DICTIONARY.missions.toasts.updated);
    } else {
      createMission(input, drafts);
      notifySuccess(DICTIONARY.missions.toasts.created);
    }
    onClose();
  };

  return (
    <Modal
      title={isEdit ? DICTIONARY.missions.modals.title_edit : DICTIONARY.missions.modals.title_create}
      subtitle={isEdit ? undefined : `MN-${missionsLength + 1}`}
      confirmLabel={DICTIONARY.missions.buttons.save_mission}
      confirmDisabled={confirmDisabled}
      onClose={onClose}
      onConfirm={handleSave}
      className="max-w-3xl min-h-[400px]"
    >
      <MissionForm
        missionId={mission?.id}
        setDidChange={() => {}}
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
    </Modal>
  );
}
