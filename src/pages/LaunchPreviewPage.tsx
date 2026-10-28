import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { LaunchEditor } from "@/components/launches/LaunchEditModal";
import { GoBackIconButton } from "@/components/ui/icon-buttons";
import { PreviewActionButton } from "@/components/ui/preview-action-button";
import { DICTIONARY } from "@/constants/dictionary";
import { canAccess, canEditLaunchFields, crewOwnsGroup, homePath, launchInScope } from "@/lib/access";
import { resolvePlanningEntityState } from "@/lib/entityState";
import { allocationForLaunch, taskAimingPoints } from "@/lib/launchAiming";
import { activeMissionTasks } from "@/lib/missionDashboard";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useTargetStore } from "@/store/useTargetStore";
import { useTaskStore } from "@/store/useTaskStore";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";
import { formatDateUk } from "@/lib/dates";
import { Badge, TargetBadge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { formattingMGRS } from "@/lib/formattingMGRS";
export function LaunchPreviewPage() {
  const { battleGroupId, taskId, missionId } = useParams();
  const navigate = useNavigate();
  const battleGroups = useBattleGroupStore((state) => state.battleGroups);
  const launches = useLaunchStore((state) => state.launches);
  const tasks = useTaskStore((state) => state.tasks);
  const missions = useMissionStore((state) => state.missions);
  const targets = useTargetStore((state) => state.targets);
  const aimingPoints = useTargetStore((state) => state.aimingPoints);
  const role = useAuthStore((state) => state.role);
  const entityId = useAuthStore((state) => state.entityId);
  const [isEditMode, setIsEditMode] = useState(false);

  const routeMission = missionId ? missions.find((item) => item.id === missionId) : undefined;
  const missionTasks = routeMission ? activeMissionTasks(routeMission, tasks) : [];
  const group = missionId ? undefined : battleGroups.find((item) => item.id === battleGroupId);
  const task = missionId ? missionTasks[0] : tasks.find((item) => item.id === (group?.task_id ?? taskId));
  const relatedGroups = group
    ? battleGroups.filter(
        (item) =>
          item.archived_at === null &&
          item.task_id === group.task_id &&
          item.lead_crew_id === group.lead_crew_id &&
          item.asset_id === group.asset_id,
      )
    : battleGroups.filter((item) => item.task_id === task?.id && item.archived_at === null);
  const resolvedTargets = task
    ? relatedGroups
        .map((item) => allocationForLaunch(task, { allocation_line_id: null, asset_id: item.asset_id }, item)?.target_id)
        .filter((id): id is string => Boolean(id))
    : [];
  const uniqueTargetIds = [...new Set(resolvedTargets)];
  const target = uniqueTargetIds.length === 1 ? targets.find((item) => item.id === uniqueTargetIds[0]) : undefined;
  const missionLine = task
    ? allocationForLaunch(
        task,
        { allocation_line_id: null, asset_id: relatedGroups[0]?.asset_id ?? "" },
        relatedGroups[0],
      )
    : undefined;
  const mission = missionLine ? missions.find((item) => item.id === missionLine.mission_id) : undefined;

  if (missionId ? !routeMission : !task) {
    return (
      <section className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-2">
          <GoBackIconButton onClick={() => navigate("/planning/launches")} />
          <h1 className="text-xl font-semibold">{DICTIONARY.launches.not_found}</h1>
        </div>
      </section>
    );
  }

  const pageTasks = missionId ? missionTasks : task ? [task] : [];
  const blocks = pageTasks.flatMap((item) => {
    const candidates = missionId
      ? battleGroups.filter((entry) => entry.archived_at === null && entry.task_id === item.id)
      : relatedGroups;
    const itemGroups = candidates.filter((entry) => launchInScope(role, entityId, item, entry));
    if (itemGroups.length === 0) {
      return [];
    }
    const itemGroupIds = new Set(itemGroups.map((entry) => entry.id));
    const itemLaunches = launches.filter(
      (launch) => launch.archived_at === null && itemGroupIds.has(launch.battle_group_id),
    );
    const itemTargetIds = [
      ...new Set(
        itemGroups
          .map((entry) => allocationForLaunch(item, { allocation_line_id: null, asset_id: entry.asset_id }, entry)?.target_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    return [{
      task: item,
      groups: itemGroups,
      launches: itemLaunches,
      target: itemTargetIds.length === 1 ? targets.find((entry) => entry.id === itemTargetIds[0]) : undefined,
    }];
  });
  if (blocks.length === 0) {
    return <Navigate to={homePath(role)} replace />;
  }
  const pageMission = routeMission ?? mission;
  const sampleLaunch = blocks.flatMap((block) => block.launches).find((item) => item.archived_at === null);
  const entityState = resolvePlanningEntityState(blocks[0].task, pageMission, sampleLaunch);
  const locked = entityState !== "active";
  const canEdit = canEditLaunchFields(role) && blocks.some((block) => block.groups.some((item) => crewOwnsGroup(item, entityId)));
  const editing = isEditMode && !locked && canEdit;

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
      <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-10">
          <p className="flex flex-wrap items-center gap-1 text-[20px] text-primitive-neutral-0">
            <Calendar className="h-5 w-5 shrink-0" aria-hidden="true" />
            <Badge className="bg-primitive-neutral-800 text-[20px]">{formatDateUk(pageMission?.scheduled_at ?? "")}</Badge>
            <span>{` — ${pageMission?.name ?? pageMission?.label ?? ""}`}</span>
          </p>
          {target ? (
            <div className="flex flex-wrap items-center min-w-0 gap-3 font-semibold">
              <TargetBadge
                targetId={target?.id ?? ""}
                mgrs={formattingMGRS.spacing(target?.mgrs ?? "")}
                label={`${target?.name ?? ""}`}
                wrapperClasses="basis-0 gap-2 font-semibold w-fit flex items-center flex-1"
              />
              <span className="text-sm text-primitive-neutral-300">{` (${target?.address ?? ""})`}</span>
            </div>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 flex flex-col gap-4 overflow-y-auto rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 p-4">
          {role === "CENTER" ? (
            <LaunchEditor
              key={blocks.map((block) => block.task.id).join(",")}
              task={blocks[0].task}
              mission={pageMission}
              target={blocks.length === 1 ? blocks[0].target ?? target : undefined}
              aimingPoints={aimingPoints}
              battleGroups={blocks.flatMap((block) => block.groups)}
              launches={blocks.flatMap((block) => block.launches)}
              editing={editing}
              locked={locked}
            />
          ) : (
            blocks.map((block) => (
              <LaunchEditor
                key={block.task.id}
                task={block.task}
                mission={pageMission}
                target={block.target ?? target}
                aimingPoints={taskAimingPoints(block.task, aimingPoints)}
                battleGroups={block.groups}
                launches={block.launches}
                editing={editing}
                locked={locked}
              />
            ))
          )}
          {!missionId && canAccess(role, "tasks") ? (
            <div className="mt-auto">
              <PreviewActionButton
                label={DICTIONARY.common.actions.preview_task}
                onClick={() => navigate(`/planning/tasks/${blocks[0].task.id}`)}
              />
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}
