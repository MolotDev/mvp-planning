import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { LaunchEditor } from "@/components/launches/LaunchEditModal";
import { GoBackIconButton } from "@/components/ui/icon-buttons";
import { PreviewActionButton } from "@/components/ui/preview-action-button";
import { DICTIONARY } from "@/constants/dictionary";
import { canAccess, canEditLaunchFields, crewOwnsGroup, homePath, launchInScope } from "@/lib/access";
import { getEntityState } from "@/lib/entityState";
import { taskAimingPoints } from "@/lib/launchAiming";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useTargetStore } from "@/store/useTargetStore";
import { useTaskStore } from "@/store/useTaskStore";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";

export function LaunchPreviewPage() {
  const { battleGroupId, taskId } = useParams();
  const navigate = useNavigate();
  const battleGroups = useBattleGroupStore((state) => state.battleGroups);
  const updateBattleGroup = useBattleGroupStore((state) => state.updateBattleGroup);
  const launches = useLaunchStore((state) => state.launches);
  const tasks = useTaskStore((state) => state.tasks);
  const missions = useMissionStore((state) => state.missions);
  const targets = useTargetStore((state) => state.targets);
  const aimingPoints = useTargetStore((state) => state.aimingPoints);
  const role = useAuthStore((state) => state.role);
  const entityId = useAuthStore((state) => state.entityId);
  const [isEditMode, setIsEditMode] = useState(false);

  const group = battleGroups.find((item) => item.id === battleGroupId);
  const task = tasks.find((item) => item.id === (group?.task_id ?? taskId));
  const line = task?.allocations[0];
  const mission = line ? missions.find((item) => item.id === line.mission_id) : undefined;
  const target = line ? targets.find((item) => item.id === line.target_id) : undefined;

  if (!task) {
    return (
      <section className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-2">
          <GoBackIconButton onClick={() => navigate("/planning/launches")} />
          <h1 className="text-xl font-semibold">{DICTIONARY.launches.not_found}</h1>
        </div>
      </section>
    );
  }

  const scopedGroups = (group
    ? [group]
    : battleGroups.filter((item) => item.task_id === task.id && item.archived_at === null)
  ).filter((item) => launchInScope(role, entityId, task, item));
  if (scopedGroups.length === 0) {
    return <Navigate to={homePath(role)} replace />;
  }
  const scopedGroupIds = new Set(scopedGroups.map((item) => item.id));
  const scopedLaunches = launches.filter((launch) => {
    if (launch.archived_at !== null || !scopedGroupIds.has(launch.battle_group_id)) {
      return false;
    }
    return group ? launch.battle_group_id === group.id : launch.task_id === task.id;
  });
  const taskState = getEntityState(task);
  const missionState = mission ? getEntityState(mission) : "active";
  const locked = taskState !== "active" || missionState !== "active";
  const canEdit = canEditLaunchFields(role) && scopedGroups.some((item) => crewOwnsGroup(item, entityId));
  const editing = isEditMode && !locked && canEdit;
  const entityState = taskState === "active" && missionState === "active" ? "active" : missionState !== "active" ? missionState : taskState;

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <GoBackIconButton onClick={() => navigate(-1)} />
          <EntityStatusBadge status={entityState} />
          {locked ? (
            <p className="text-sm text-primitive-neutral-300">{DICTIONARY.launches.labels.read_only_locked}</p>
          ) : null}
        </div>
        {!locked && canEdit && (
          <div className="flex items-center gap-2 text-sm text-primitive-neutral-200">
            <span id="launch-edit-mode-label">{DICTIONARY.tasks.launch_board.edit_launches}</span>
            <button
              type="button"
              role="switch"
              aria-checked={editing}
              aria-labelledby="launch-edit-mode-label"
              disabled={locked}
              onClick={() => {
                if (locked) {
                  return;
                }
                setIsEditMode((current) => !current);
              }}
              className={cn(
                "relative h-6 w-11 rounded-full hover:cursor-pointer hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50",
                editing
                  ? "bg-primitive-blue-500 hover:bg-primitive-blue-500/90"
                  : "bg-primitive-neutral-700 hover:bg-primitive-neutral-600",
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
        )}
      </header>
      <div className="min-h-0 flex-1 flex flex-col gap-4 overflow-y-auto rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 p-4">
        <LaunchEditor
          key={group?.id ?? task.id}
          task={task}
          mission={mission}
          target={target}
          aimingPoints={taskAimingPoints(task, aimingPoints)}
          updateBattleGroup={updateBattleGroup}
          battleGroups={scopedGroups}
          launches={scopedLaunches}
          editing={editing}
          locked={locked}
        />
        {canAccess(role, "tasks") ? (
          <div className="mt-auto">
            <PreviewActionButton
              label={DICTIONARY.common.actions.preview_task}
              onClick={() => navigate(`/planning/tasks/${task.id}`)}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
