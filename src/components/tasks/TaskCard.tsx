import { useMemo } from "react";
import { ArrowUpRight, Calendar, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ViewReportButton } from "@/components/reports/ViewReportButton";
import { AllocationConflictBadge } from "@/components/tasks/QuantityDiscrepancy";
import { AimingPointBadge, Badge, ProgressBadge, TargetBadge } from "@/components/ui/badge";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { PreviewIconButton, ResetIconButton } from "@/components/ui/icon-buttons";
import { PreviewActionButton } from "@/components/ui/preview-action-button";
import { DICTIONARY } from "@/constants/dictionary";
import { canAccess, canAdminister } from "@/lib/access";
import { crewName, uavName, visibleBattleGroups } from "@/lib/battleGroup";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { formatDateUk } from "@/lib/dates";
import { detachmentName } from "@/lib/detachments";
import { getEntityState } from "@/lib/entityState";
import { formattingMGRS } from "@/lib/formattingMGRS";
import { countProcessedLaunches } from "@/lib/launches";
import { filledBoardCount } from "@/lib/missionCascade";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import type { BattleGroup } from "@/types/battleGroup";
import type { Mission, Task, TaskAllocation } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";

interface TaskCardProps {
  task: Task;
  missions: Mission[];
  targets: Target[];
  aimingPoints: AimingPoint[];
  battleGroups: BattleGroup[];
  onPreview: (task: Task) => void;
  onRestore: (task: Task) => void;
  reportId: string;
}

interface TargetGroup {
  targetId: string;
  allocations: TaskAllocation[];
}

interface MissionGroup {
  missionId: string;
  targets: TargetGroup[];
}

export function TaskCard({ task, missions, reportId, targets, battleGroups, aimingPoints, onPreview, onRestore }: TaskCardProps) {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);
  const managesTasks = canAdminister(role, "tasks");
  const canOpenMission = canAccess(role, "missions");
  const canOpenLaunches = canAccess(role, "launches");
  const launches = useLaunchStore((state) => state.launches);
  const entityState = getEntityState(task);
  const assignedGroups = visibleBattleGroups(task, battleGroups);
  const scheduledAt = task.scheduled_at || task.created_at;
  const groupedMissions = useMemo(() => {
    const missionsMap: Record<string, { missionId: string; targets: Record<string, TargetGroup> }> = {};
    (task.allocations || []).forEach((alloc) => {
      if (!missionsMap[alloc.mission_id]) {
        missionsMap[alloc.mission_id] = {
          missionId: alloc.mission_id,
          targets: {},
        };
      }
      if (!missionsMap[alloc.mission_id].targets[alloc.target_id]) {
        missionsMap[alloc.mission_id].targets[alloc.target_id] = {
          targetId: alloc.target_id,
          allocations: [],
        };
      }
      missionsMap[alloc.mission_id].targets[alloc.target_id].allocations.push(alloc);
    });
    return Object.values(missionsMap).map((group): MissionGroup => ({
      missionId: group.missionId,
      targets: Object.values(group.targets),
    }));
  }, [task.allocations]);

  const assetTotals = task.allocations.reduce((totals, line) => {
    totals.set(line.asset_id, (totals.get(line.asset_id) ?? 0) + line.quantity);
    return totals;
  }, new Map<string, number>());
  const totalQuantity = [...assetTotals.values()].reduce((sum, quantity) => sum + quantity, 0);
  const totalAssets = [...assetTotals.entries()].map(([assetId, quantity]) => `${uavName(assetId)} × ${quantity}`).join(", ");

  const mainMission = groupedMissions[0]
    ? missions.find((item) => item.id === groupedMissions[0].missionId)
    : undefined;

  return (
    <Card className={cn(entityState === "archived" ? "opacity-60" : "hover:cursor-pointer")} onDoubleClick={() => onPreview(task)}>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold text-primitive-neutral-200" title={task.label}>
            {task.label}
          </p>
          <EntityStatusBadge status={entityState} />
        </div>
        {role === "CENTER" ? (
          <p className="font-medium text-primitive-neutral-0">{detachmentName(task.organization_id)}</p>
        ) : null}
        <div onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
          {role === "CENTER" ? (
            <PreviewIconButton onClick={() => onPreview(task)} />
          ) : assignedGroups.length > 0 ? (
            <PreviewIconButton onClick={() => navigate(`/planning/tasks/${task.id}`)} />
          ) : null}
        </div>
      </CardHeader>
      <CardBody className="gap-3">
        <div className="flex flex-col gap-2 p-2">
          <div className="flex items-center gap-1 text-sm text-primitive-neutral-200">
            <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
            <Badge className="bg-primitive-neutral-800 text-[18px]">{formatDateUk(scheduledAt)}</Badge>
            {groupedMissions.length === 1 && mainMission && (
              <>
                <span className="text-muted-foreground/40">•</span>
                {role === "CENTER" ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/planning/missions/${mainMission.id}`)}
                    title={`Перейти до вогневого завдання ${mainMission.label}`}
                    className="group inline-flex items-center gap-1 font-medium text-zinc-400 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    <span className="underline underline-offset-4">
                      {mainMission.label} — {mainMission.name}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-sky-400/70 group-hover:text-sky-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </button>
                ) : (
                  <p className="truncate text-md font-medium text-zinc-400" title={`${mainMission.label} — ${mainMission.name}`}>
                    {mainMission.label} — {mainMission.name}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        {groupedMissions.map((group) => {
          const mission = missions.find((item) => item.id === group.missionId);
          const missionName = mission?.name?.trim() || "";
          const missionLabel = missionName && mission?.label && missionName !== mission.label
            ? `${mission.label} — ${missionName}`
            : missionName || mission?.label || "";
          return (
            <div key={group.missionId} className="flex flex-col gap-2">
              {groupedMissions.length > 1 && (
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-primitive-neutral-0" title={missionLabel}>
                    {missionLabel}
                  </p>
                  {canOpenMission && mission ? (
                    <div onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
                      <PreviewActionButton
                        label={DICTIONARY.common.actions.preview_mission}
                        onClick={() => navigate(`/planning/missions/${mission.id}`)}
                      />
                    </div>
                  ) : null}
                </div>
              )}
              {group.targets.map((targetGroup) => {
                const target = targets.find((item) => item.id === targetGroup.targetId);
                return (
                  <div key={targetGroup.targetId} className="flex flex-col gap-2 mb-3 last:mb-0">
                    {target ? <TargetBadge targetId={target.id} mgrs={formattingMGRS.spacing(target.mgrs)} label={target.name} /> : null}
                    <div className="flex flex-col gap-2 border-l border-primitive-neutral-700 bg-primitive-neutral-850/40 py-1 pl-3 pr-2">
                      {targetGroup.allocations.map((line) => {
                        const aimingPoint = aimingPoints.find((item) => item.id === line.aiming_point_id);
                        const lineLaunches = launches.filter(
                          (launch) => launch.archived_at === null && launch.allocation_line_id === line.id,
                        );
                        const assignedCrews = assignedGroups.filter((item) => item.asset_id === line.asset_id).map((item) => crewName(item.lead_crew_id));
                        const distributed = countProcessedLaunches(lineLaunches).total;
                        const filledBoards = filledBoardCount(lineLaunches);
                        return (
                          <div key={line.id} className="flex flex-wrap items-center gap-2 ml-2">
                            <AimingPointBadge
                              label={aimingPoint?.name ?? DICTIONARY.tasks.allocation.primary_target}
                              mgrs={formattingMGRS.spacing(aimingPoint?.mgrs ?? target?.mgrs ?? "")}
                            />
                            <ProgressBadge
                              className="text-sm ml-auto"
                              label={`${assignedCrews.length > 0 ? `${assignedCrews.join(`•`)} • ` : ""}${uavName(line.asset_id)} × ${line.quantity}`}
                              processed={distributed}
                              total={line.quantity}
                            />
                            {filledBoards > line.quantity ? (
                              <AllocationConflictBadge planned={line.quantity} filled={filledBoards} />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </CardBody>
      <CardFooter className="flex-col items-stretch gap-2">
        {totalQuantity > 0 ? (
          <p className="text-sm text-zinc-400 text-center border border-primitive-neutral-700 rounded-md p-2">
            {fillTemplate(DICTIONARY.tasks.allocation.total_assets, {
              quantity: totalQuantity,
              assets: totalAssets,
            })}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          {managesTasks && entityState === "archived" ? (
            <div onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
              <ResetIconButton onClick={() => onRestore(task)} />
            </div>
          ) : <span />}
          <div
            className="flex flex-1 justify-end gap-2"
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            {role === "DETACHMENT" && entityState === "active" && !assignedGroups.length ? (
              <Button className="h-7" onClick={() => navigate(`/planning/tasks/${task.id}?isEditMode=true`)}>
                <Users className="h-4 w-4" aria-hidden="true" />
                {DICTIONARY.common.actions.distribute}
              </Button>
            ) : null}
            {canOpenLaunches && assignedGroups.length > 0 ? (
              <PreviewActionButton
                label={DICTIONARY.common.actions.preview_launches}
                onClick={() => navigate(`/planning/launches/${assignedGroups[0].id}`)}
              />
            ) : null}
            {reportId ? <ViewReportButton reportId={reportId} /> : null}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
