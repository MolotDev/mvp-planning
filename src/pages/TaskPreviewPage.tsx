import { Fragment, useState } from "react";
import { Calendar, Divide, MapPinned, Users } from "lucide-react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AssignCrewsModal } from "@/components/tasks/AssignCrewsModal";
import { BattleGroupSummaryList } from "@/components/tasks/BattleGroupSummary";
import { AimingPointBadge, Badge, ProgressBadge, TargetBadgeLink } from "@/components/ui/badge";
import { GoBackIconButton } from "@/components/ui/icon-buttons";
import { PreviewActionButton } from "@/components/ui/preview-action-button";
import { DICTIONARY } from "@/constants/dictionary";
import { canAdminister, homePath, taskInScope } from "@/lib/access";
import { taskAllocatedQuantity, taskAllocation, uavName } from "@/lib/battleGroup";
import { formatDateUk } from "@/lib/dates";
import { getEntityState } from "@/lib/entityState";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useTaskStore } from "@/store/useTaskStore";
import { useTargetStore } from "@/store/useTargetStore";
import type { BattleGroup } from "@/types/battleGroup";
import { formattingMGRS } from "@/lib/formattingMGRS";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";
import { Button } from "@/components/ui/button";

export function TaskPreviewPage() {
  const { taskId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const isEditMode = searchParams.get('isEditMode') === 'true' ? true : false;
  const navigate = useNavigate();
  const task = useTaskStore((state) => state.tasks.find((item) => item.id === taskId));
  const missions = useMissionStore((state) => state.missions);
  const targets = useTargetStore((state) => state.targets);
  const aimingPoints = useTargetStore((state) => state.aimingPoints);
  const battleGroups = useBattleGroupStore((state) => state.battleGroups);
  const role = useAuthStore((state) => state.role);
  const entityId = useAuthStore((state) => state.entityId);
  // const [isEditMode, setIsEditMode] = useState(true);
  const [modalGroup, setModalGroup] = useState<BattleGroup | null | undefined>(undefined);
  const mission = task
    ? missions.find((item) => task.allocations.some((line) => line.mission_id === item.id))
    : undefined;

  if (task && !taskInScope(task, role, entityId)) {
    return <Navigate to={homePath(role)} replace />;
  }

  if (!task) {
    return (
      <section className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-2">
          <GoBackIconButton onClick={() => navigate(-1)} />
          <h1 className="text-xl font-semibold">{DICTIONARY.tasks.not_found}</h1>
        </div>
      </section>
    );
  }

  const entityState = getEntityState(task);
  // const canToggleEdit = canAdminister(role, "tasks") && entityState === "active";
  const canGotoMission = canAdminister(role, "missions") && entityState === "active";
  // const editMode = isEditMode && canToggleEdit;
  const scheduledAt = task.scheduled_at || task.created_at;
  const allocation = taskAllocation(task);
  const totalQuantity = task.allocations.reduce((sum, line) => sum + line.quantity, 0);
  const allocated = taskAllocatedQuantity(battleGroups, task.id);
  const assetData = {
    label: allocation.map((item) => uavName(item.asset_id)).join(", "),
    quantity: totalQuantity,
  };
  const assignedGroups = battleGroups.filter(
    (group) => group.task_id === task.id || task.battle_groups_ids.includes(group.id),
  );

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <GoBackIconButton onClick={() => navigate(-1)} />
          <EntityStatusBadge status={entityState} />
          <h4 className="font-semibold text-primitive-neutral-0 text-lg">
            {`Політна заявка: ${task.label}`}
          </h4>
          {/* {entityState !== "reported" && (
            <LaunchProgressBadge launches={launches.filter((launch) => launch.task_id === task.id)} />
          )} */}
        </div>
        {/* {canToggleEdit && (
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
        )} */}
      </header>
      <div className="flex-1 flex flex-col items-center overflow-hidden">
        <div className="flex w-full max-w-3xl min-h-full flex-col gap-3 overflow-y-auto rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 px-10 py-6">
          {/* <h5 className="text-sm font-semibold text-primitive-neutral-0 mb-4">{DICTIONARY.tasks.overview}</h5> */}
          <p className="flex flex-wrap items-center gap-1 text-[20px] text-primitive-neutral-0">
            <Calendar className="h-5 w-5 shrink-0" aria-hidden="true" />
            <Badge className="bg-primitive-neutral-800 text-[20px]">{formatDateUk(scheduledAt)}</Badge>
          </p>
          {task.allocations.map((line) => {
            const lineMission = missions.find((item) => item.id === line.mission_id);
            const lineTarget = targets.find((item) => item.id === line.target_id);
            const aimingPoint = aimingPoints.find((point) => point.id === line.aiming_point_id && point.archived_at === null);
            const missionLabel = lineMission?.name?.trim() || lineMission?.label || "";
            return (
              <div key={line.id} className="mb-4 flex flex-col gap-2">
                <p className="text-lg font-semibold text-primitive-neutral-0">{missionLabel}</p>
                {lineMission?.description ? (
                  <p className="whitespace-pre-wrap text-md text-primitive-neutral-200">{lineMission.description}</p>
                ) : null}
                {lineTarget ? (
                  <div className="flex items-start gap-2">
                    <div className="h-9 flex items-center justify-center">
                      <MapPinned className="h-5 w-5 shrink-0" aria-hidden="true" />
                    </div>
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <TargetBadgeLink className="tracking-widest text-lg" id={lineTarget.id}>
                        {formattingMGRS.spacing(lineTarget.mgrs)}
                      </TargetBadgeLink>
                      <p className="font-medium text-primitive-neutral-0 text-lg">{lineTarget.name}</p>
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-4">
                  <AimingPointBadge
                    label={aimingPoint?.name ?? "Основна ціль"}
                    mgrs={formattingMGRS.spacing(aimingPoint?.mgrs ?? lineTarget?.mgrs ?? "")}
                  />
                  <ProgressBadge
                    label={`${uavName(line.asset_id)} × ${line.quantity}`}
                    processed={0}
                    total={line.quantity}
                  />
                </div>
              </div>
            );
          })}
          <div className={cn("flex items-center justify-between mb-4")}>
            <div className="flex gap-4">
              <ProgressBadge label={`${assetData.label} × ${assetData.quantity}`} processed={allocated} total={totalQuantity} />
            </div>
              {role === "DETACHMENT" && entityState === "active" ? (
                <div className="flex items-end gap-2">
                  <Button className="h-7" onClick={() => setModalGroup(null)}>
                    <Divide className="h-4 w-4" aria-hidden="true" />
                    {DICTIONARY.common.actions.distribute}
                  </Button>
                </div>
              ) : null}
            {/* <div className="ml-6 flex items-end justify-between">
              <BattleGroupSummaryList groups={assignedGroups} assetData={assetData} showProgress />
              {assignedGroups.length === 0 && role === 'DETACHMENT' ? (
                <div className="flex items-end gap-2">
                  <Button className="h-7" onClick={() => navigate(`/planning/tasks/${task.id}`)}>
                    <Divide className="h-4 w-4" aria-hidden="true" />
                    {DICTIONARY.common.actions.distribute}
                  </Button>
                </div>
              ) : null}
            </div> */}
          </div>
          <hr className="border-primitive-neutral-800" />
          {assignedGroups.map((group) => (
            <Fragment key={group.id}>
            <div className="flex items-center flex-wrap gap-2">
              <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="font-medium text-primitive-neutral-0">{group.lead_crew_id}</p>
              <ProgressBadge label={`${uavName(group.asset_id)} × ${group.uav_quantity}`} processed={0} total={0} />
              {/* {Object.entries(detachment.assetsQuantity).map(([assetId, numbers]) => (
                <ProgressBadge key={assetId} label={`${uavName(assetId)} × ${numbers.quantity}`} processed={numbers.processed} total={numbers.quantity} />
              ))} */}
            </div>
            </Fragment>
          ))}
          <BattleGroupSummaryList groups={assignedGroups} assetData={assetData} showProgress />
          {/* <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-primitive-neutral-200">{DICTIONARY.tasks.aiming_points}</span>
            {aimingPoint ? (
              <span className="font-medium text-primitive-neutral-0">{aimingPoint.name}</span>
            ) : null}
            {aimingMgrs ? (
              <Badge className="bg-primitive-neutral-800 font-semibold tracking-wide text-primitive-neutral-0">
                {formattingMGRS.spacing(aimingMgrs)}
              </Badge>
            ) : null}
          </div> */}
          {/* <AimingPointWarnings tasks={[task]} />
          <hr className="border-primitive-neutral-800" /> */}
          {/* <DetachmentAssets organizationId={task.organization_id} assets={allocation} />
          <p className={cn("text-sm font-medium", quotaMet ? "text-primitive-green-500" : "text-primitive-red-500")}>
            {fillTemplate(DICTIONARY.tasks.allocated_quota, { allocated, total: task.quantity })}
          </p>
          <BattleGroupSummaryList groups={groups} assetData={{label: uavName(task.asset_id), quantity: task.quantity}} showProgress /> */}
          {canGotoMission && mission ? (
            <div className="mt-auto flex justify-end">
              <PreviewActionButton
                label={DICTIONARY.common.actions.preview_mission}
                onClick={() => navigate(`/planning/missions/${mission.id}`)}
              />
            </div>
          ) : null}
        </div>
        {/* <BattleGroupPanel
          groups={groups}
          taskAssets={allocation}
          canEdit={editMode}
          onAdd={() => setModalGroup(null)}
          onEdit={setModalGroup}
        /> */}
      </div>
      {isEditMode || modalGroup !== undefined ? (
        <AssignCrewsModal
          taskId={task.id}
          onClose={() => {
            setModalGroup(undefined);
            setSearchParams({}, { replace: true });
          }}
        />
      ) : null}
    </section>
  );
}
