import { useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AimingPointWarnings } from "@/components/tasks/AimingPointWarnings";
import { BattleGroupModal } from "@/components/tasks/BattleGroupModal";
import { BattleGroupPanel } from "@/components/tasks/BattleGroupPanel";
import { BattleGroupSummaryList } from "@/components/tasks/BattleGroupSummary";
import { DetachmentAssets } from "@/components/tasks/DetachmentAssets";
import { Badge, TargetIdBadgeLink } from "@/components/ui/badge";
import { GoBackIconButton } from "@/components/ui/icon-buttons";
import { PreviewActionButton } from "@/components/ui/preview-action-button";
import { DICTIONARY } from "@/constants/dictionary";
import { canAdminister, homePath, taskInScope } from "@/lib/access";
import { visibleBattleGroups } from "@/lib/battleGroup";
import { formatDateUk } from "@/lib/dates";
import { getEntityState } from "@/lib/entityState";
import { cn } from "@/lib/utils";
import { LaunchProgressBadge } from "@/components/tasks/LaunchProgressBadge";
import { useAuthStore } from "@/store/useAuthStore";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useTaskStore } from "@/store/useTaskStore";
import { useTargetStore } from "@/store/useTargetStore";
import type { BattleGroup } from "@/types/battleGroup";
import { formattingMGRS } from "@/lib/formattingMGRS";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";

export function TaskPreviewPage() {
  const { taskId = "" } = useParams();
  const navigate = useNavigate();
  const task = useTaskStore((state) => state.tasks.find((item) => item.id === taskId));
  const mission = useMissionStore((state) =>
    task ? state.missions.find((item) => item.id === task.mission_id) : undefined,
  );
  const targets = useTargetStore((state) => state.targets);
  const battleGroups = useBattleGroupStore((state) => state.battleGroups);
  const launches = useLaunchStore((state) => state.launches);
  const role = useAuthStore((state) => state.role);
  const entityId = useAuthStore((state) => state.entityId);
  const [isEditMode, setIsEditMode] = useState(false);
  const [modalGroup, setModalGroup] = useState<BattleGroup | null | undefined>(undefined);

  const target = useMemo(
    () => (task ? targets.find((item) => task.target_ids.includes(item.id)) : undefined),
    [task, targets],
  );
  const linkedGroups = useMemo(() => {
    if (!task) {
      return [];
    }
    return battleGroups.filter(
      (group) => group.task_id === task.id || task.battle_groups_ids.includes(group.id),
    );
  }, [battleGroups, task]);

  if (task && !taskInScope(task, role, entityId)) {
    return <Navigate to={homePath(role)} replace />;
  }

  if (!task) {
    return (
      <section className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-2">
          <GoBackIconButton onClick={() => navigate("/planning/tasks")} />
          <h1 className="text-xl font-semibold">{DICTIONARY.tasks.not_found}</h1>
        </div>
      </section>
    );
  }

  const entityState = getEntityState(task);
  const canToggleEdit = canAdminister(role, "tasks") && entityState === "active";
  const canGotoMission = canAdminister(role, "missions") && entityState === "active";
  const editMode = isEditMode && canToggleEdit;
  const groups = visibleBattleGroups(task, linkedGroups);
  const scheduledAt = mission?.scheduled_at ?? task.created_at;
  const headingName = mission?.name?.trim() ? mission.name : (target?.name ?? "");

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <GoBackIconButton onClick={() => navigate("/planning/tasks")} />
          <EntityStatusBadge status={entityState} />
          {entityState !== "reported" && (
            <LaunchProgressBadge launches={launches.filter((launch) => launch.task_id === task.id)} />
          )}
        </div>
        {canToggleEdit && (
          <div className="flex items-center gap-2 text-sm text-primitive-neutral-200">
            <span id="task-edit-mode-label">{DICTIONARY.tasks.edit_toggle}</span>
            <button
              type="button"
              role="switch"
              aria-checked={editMode}
              aria-labelledby="task-edit-mode-label"
              disabled={!canToggleEdit}
              onClick={() => {
                if (!canToggleEdit) {
                  return;
                }
                setIsEditMode((current) => !current);
              }}
              className={cn(
                "relative h-6 w-11 rounded-full hover:cursor-pointer hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50",
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
        )}
      </header>
      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 p-4">
          <h5 className="text-sm font-semibold text-primitive-neutral-0 mb-4">{DICTIONARY.tasks.overview}</h5>
          <p className="flex flex-wrap items-center gap-1 text-[20px] text-primitive-neutral-0">
            <Calendar className="h-5 w-5 shrink-0" aria-hidden="true" />
            <Badge className="bg-primitive-neutral-800 text-[20px]">{formatDateUk(scheduledAt)}</Badge>
            {headingName ? (
              <>
                <span>—</span>
                <span>{headingName}</span>
              </>
            ) : null}
          </p>
          {mission?.description ? (
            <p className="whitespace-pre-wrap text-md mb-4 text-primitive-neutral-200">{mission.description}</p>
          ) : null}
          {target ? (
            <div className="flex flex-wrap items-baseline gap-2 text-[16px] font-semibold mb-4">
              <TargetIdBadgeLink id={target.id}>{target.displayed_id || target.label || "—"}</TargetIdBadgeLink>
              <h4 className="text-[16px] font-semibold text-primitive-neutral-0">{target.name}</h4>
              <Badge className="bg-primitive-neutral-800 text-[16px] font-semibold tracking-wide text-primitive-neutral-0">
                {formattingMGRS.spacing(target.mgrs)}
              </Badge>
            </div>
          ) : null}
          <p className="text-sm font-medium text-primitive-neutral-200">{DICTIONARY.tasks.aiming_points}</p>
          <AimingPointWarnings tasks={[task]} />
          <hr className="border-primitive-neutral-800" />
          <DetachmentAssets organizationId={task.organization_id} assets={task.assets} />
          <BattleGroupSummaryList groups={groups} showProgress />
          {canGotoMission && (
            <div className="mt-auto flex justify-end">
              <PreviewActionButton
                label={DICTIONARY.common.actions.preview_mission}
                onClick={() => navigate(`/planning/missions/${task.mission_id}`)}
              />
            </div>
          )}
        </div>
        <BattleGroupPanel
          groups={groups}
          taskAssets={task.assets}
          canEdit={editMode}
          onAdd={() => setModalGroup(null)}
          onEdit={setModalGroup}
        />
      </div>
      {modalGroup !== undefined ? (
        <BattleGroupModal
          taskId={task.id}
          organizationId={task.organization_id}
          taskAssets={task.assets}
          battleGroup={modalGroup}
          onClose={() => setModalGroup(undefined)}
        />
      ) : null}
    </section>
  );
}
