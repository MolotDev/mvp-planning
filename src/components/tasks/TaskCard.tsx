import { Calendar, Divide, MapPinned } from "lucide-react";
// import { AimingPointWarnings } from "@/components/tasks/AimingPointWarnings";
import { BattleGroupSummaryList } from "@/components/tasks/BattleGroupSummary";
// import { QuantityDiscrepancy } from "@/components/tasks/QuantityDiscrepancy";
// import { DetachmentAssets } from "@/components/tasks/DetachmentAssets";
import { ViewReportButton } from "@/components/reports/ViewReportButton";
import { AimingPointBadge, Badge, TargetBadgeLink } from "@/components/ui/badge";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { EditIconButton, PreviewIconButton, ResetIconButton } from "@/components/ui/icon-buttons";
import { canAdminister } from "@/lib/access";
import { uavName, visibleBattleGroups } from "@/lib/battleGroup";
// import { quantityDiscrepancy } from "@/lib/launches";
import { formatDateUk } from "@/lib/dates";
import { getEntityState } from "@/lib/entityState";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
// import { useLaunchStore } from "@/store/useLaunchStore";
import type { BattleGroup } from "@/types/battleGroup";
import type { Mission, Task } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";
import { formattingMGRS } from "@/lib/formattingMGRS";
import { useNavigate } from "react-router-dom";
import { detachmentName } from "@/lib/detachments";
import { PreviewActionButton } from "../ui/preview-action-button";
import { DICTIONARY } from "@/constants/dictionary";
import { Button } from "../ui/button";

interface TaskCardProps {
  task: Task;
  mission: Mission | undefined;
  target: Target | undefined;
  aimingPoint: AimingPoint | undefined;
  battleGroups: BattleGroup[];
  onPreview: (task: Task) => void;
  onRestore: (task: Task) => void;
  reportId: string;
}

export function TaskCard({ task, mission, reportId, target, battleGroups, aimingPoint, onPreview, onRestore }: TaskCardProps) {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);
  const managesTasks = canAdminister(role, "tasks");
  // const launches = useLaunchStore((state) => state.launches);
  const entityState = getEntityState(task);
  const assignedGroups = visibleBattleGroups(task, battleGroups);
  const scheduledAt = mission?.scheduled_at ?? task.created_at;
  const missionName = mission?.name ?? mission?.label ?? "";
  // const targetTitle = target ? `${target.displayed_id || target.label || "—"} — ${target.name}` : "";

  const pointData = {
    label: aimingPoint?.name ?? "Основна ціль",
    mgrs: formattingMGRS.spacing(aimingPoint?.mgrs ?? target?.mgrs ?? ""),
  }
  const assetData = {
    label: uavName(task.asset_id),
    quantity: task.quantity,
  };

  return (
    <Card className={cn(entityState === "archived" ? "opacity-60" : "hover:cursor-pointer")} onDoubleClick={() => onPreview(task)}>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold text-primitive-neutral-200" title={task.label}>
            {task.label}
          </p>
          <EntityStatusBadge status={entityState} />
        </div>
        {role === 'CENTER' ? (
          <p className="font-medium text-primitive-neutral-0">{detachmentName(task.organization_id)}</p>
        ) : null}
        <div onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
        {role === 'CENTER' ? (
          <PreviewIconButton onClick={() => onPreview(task)} />
        ) : assignedGroups.length > 0 ? (
          <EditIconButton onClick={() => navigate(`/planning/tasks/${task.id}`)} />
        ) : null}
        </div>
      </CardHeader>
      <CardBody className="gap-3">
        <div className="flex flex-col gap-1">
          <p className="flex items-center gap-1 text-sm text-primitive-neutral-200">
            <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
            <Badge className="bg-primitive-neutral-800 text-[18px]">{formatDateUk(scheduledAt)}</Badge>
            {!missionName.trim() ? null : (
              <>
                <span>—</span>
                <span className="line-clamp-2" title={missionName}>
                  {missionName}
                </span>
              </>
            )}
          </p>
          <p className="line-clamp-2 text-sm text-primitive-neutral-300" title={mission?.description ?? ""}>
            {mission?.description ?? ""}
          </p>
        </div>
        {target ? (
          <div className="flex items-start gap-2 mb-4">
            <div className="h-6 flex items-center justify-center">
              <MapPinned className="h-4 w-4 shrink-0" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                  <TargetBadgeLink className="tracking-widest text-md" id={target.id}>{formattingMGRS.spacing(target.mgrs)}</TargetBadgeLink>
                  <p className="font-medium text-primitive-neutral-0">{target.name}</p>
                </div>
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-2 rounded-lg border border-primitive-neutral-800 p-2">
          <AimingPointBadge label={pointData.label} mgrs={pointData.mgrs} />
          <div className="ml-6 flex items-end justify-between">
            <BattleGroupSummaryList groups={assignedGroups} assetData={assetData} showProgress />
            {assignedGroups.length > 0 ? (
              <div className="flex items-end gap-2">
                <PreviewActionButton
                  label={DICTIONARY.common.actions.preview_launches}
                  onClick={() => navigate(`/planning/launches/${assignedGroups[0].id}`)}
                />
              </div>
            ) : null}
            {assignedGroups.length === 0 && role === 'DETACHMENT' ? (
              <div className="flex items-end gap-2">
                <Button className="h-7" onClick={() => navigate(`/planning/tasks/${task.id}`)}>
                  <Divide className="h-4 w-4" aria-hidden="true" />
                  {DICTIONARY.common.actions.distribute}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        {/* <AimingPointWarnings tasks={[task]} /> */}
        {/* <DetachmentAssets organizationId={task.organization_id} assets={taskAllocation(task)} /> */}
        {/* <div className="mt-auto">
          <BattleGroupSummaryList groups={assignedGroups} />
        </div> */}
        {/* {assignedGroups.map((group) => {
          const discrepancy = quantityDiscrepancy(group.uav_quantity, launches, group.id);
          return discrepancy ? (
            <QuantityDiscrepancy key={group.id} planned={discrepancy.planned} actual={discrepancy.actual} />
          ) : null;
        })} */}
      </CardBody>
      <CardFooter>
        {managesTasks && entityState === "archived" && (
          <div onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
            {managesTasks && entityState === "archived" && (
              <ResetIconButton onClick={() => onRestore(task)} />
            )}
          </div>
        )}
        {role === 'CENTER' && (
          <PreviewActionButton
            label={DICTIONARY.common.actions.preview_mission}
            onClick={() => navigate(`/planning/missions/${task.mission_id}`)}
          />
        )}
        {role === 'DETACHMENT' && reportId
          ? (
            <div className="flex-1 flex justify-end gap-2">
              <ViewReportButton reportId={reportId} />
            </div>
          )
          : null}
        {/* <div className="ml-auto" onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
          <ViewReportButtons organizationIds={[task.organization_id]} scheduledAt={scheduledAt} />
        </div> */}
      </CardFooter>
    </Card>
  );
}

