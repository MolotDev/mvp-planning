import { Calendar, Crosshair, Eye, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { entityStatusBadgeStyle } from "@/components/reports/reportStatusBadge";
import { Badge, ProgressBadge, TargetIdBadgeLink } from "@/components/ui/badge";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { ViewReportButton } from "@/components/reports/ViewReportButton";
import { ArchiveIconButton, EditIconButton, ResetIconButton } from "@/components/ui/icon-buttons";
import { DICTIONARY } from "@/constants/dictionary";
import { formatDateUk } from "@/lib/dates";
import { getEntityState } from "@/lib/entityState";
import type { Mission, Task } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";
import { formattingMGRS } from "@/lib/formattingMGRS";
import { cn } from "@/lib/utils";
import { detachmentName } from "@/lib/detachments";
import { useReportStore } from "@/store/useReportStore";
import { matchingReports } from "@/lib/reportAggregation";
import { uavName } from "@/lib/battleGroup";
import { useMemo } from "react";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { Launch } from "@/types/launch";

type TargetData = {
  targetLabel: string;
  targetMgrs: string;
  targetName: string;
  detachmentData: {[detachmentId: string]: {
    detachmentName: string,
    reportId: string
    assetsQuantity: {[assetId: string]: {quantity: number, processed: number}}
    launches: Launch[]
  }};
}

interface MissionCardProps {
  mission: Mission;
  tasks: Task[];
  targets: Target[];
  aimingPoints: AimingPoint[];
  onPreview: (mission: Mission) => void;
  onArchive: (mission: Mission) => void;
  onRestore: (mission: Mission) => void;
}

export function MissionCard({
  mission,
  tasks,
  targets,
  onPreview,
  onArchive,
  onRestore,
}: MissionCardProps) {
  const navigate = useNavigate();
  const reports = useReportStore((state) => state.reports);
  const launches = useLaunchStore((state) => state.launches);
  const battleGroups = useBattleGroupStore((state) => state.battleGroups);
  const linkedTasks = tasks.filter((task) => (mission.task_ids ?? []).includes(task.id));
  const linkedTargets = targets.filter((target) =>
    linkedTasks.some((task) => (task.target_ids ?? []).includes(target.id)),
  );
  const linkedBattleGroups = battleGroups.filter((group) => linkedTasks.some((task) => task.id === group.task_id));
  const detachments = [...new Set(linkedTasks.map((task) => task.organization_id).filter(Boolean))] as string[];
  const isArchived = mission.archived_at !== null;
  const title = mission.name ?? mission.label;
  const missionDate = mission.scheduled_at;
  const currentMissionReports = matchingReports(reports, detachments, missionDate);

  const groupedTargets = useMemo(() => {
    const dataByTarget = new Map<string, TargetData>();
    linkedTasks.forEach((task) => {
      const targetId = task.target_ids[0] ?? "unknown";
      const target = linkedTargets.find((item) => item.id === targetId);
      if (!target) return;
      const detachmentId = task.organization_id;
      const detachmentData = dataByTarget.get(targetId)?.detachmentData ?? {};
      if (!detachmentData[detachmentId]) {
        const reportId = currentMissionReports.find((report) => report.organization_id === detachmentId)?.id ?? ""
        detachmentData[detachmentId] = {
          detachmentName: detachmentName(detachmentId),
          reportId,
          assetsQuantity: {[task.asset_id]: {
            quantity: task.quantity,
            processed: linkedBattleGroups.reduce((sum, battleGroup) => (
              sum + (battleGroup.task_id === task.id ? battleGroup.uav_quantity : 0)
            ), 0)}},
          launches: launches.filter((launch) => launch.task_id === task.id),
        };
      } else {
          detachmentData[detachmentId].assetsQuantity[task.asset_id] ??= {
            quantity: 0,
            processed: 0
          };
          detachmentData[detachmentId].assetsQuantity[task.asset_id].quantity += task.quantity;
          detachmentData[detachmentId].assetsQuantity[task.asset_id].processed += linkedBattleGroups.reduce((sum, battleGroup) => sum + (battleGroup.task_id === task.id ? battleGroup.uav_quantity : 0), 0);
      }
      dataByTarget.set(targetId, {
        targetLabel: target?.label ?? "",
        targetMgrs: target?.mgrs ?? "",
        targetName: target?.name ?? "",
        detachmentData,
      });
    });
    if (dataByTarget.size > 0) {
      return [...dataByTarget.entries()].map(([targetId, targetData]) => {
        return {
          section: (
            <div key={targetId} className="flex flex-col gap-2 rounded-lg border border-primitive-neutral-800 p-2">
              <div className="flex items-start gap-2">
                <div className="h-6 flex items-center justify-center">
                  <Crosshair className="h-4 w-4 shrink-0" aria-hidden="true" />
                </div>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <TargetIdBadgeLink className="text-md" id={targetId}>{targetData.targetLabel}</TargetIdBadgeLink>
                  <Badge className="text-md bg-primitive-neutral-800 min-w-fit">{formattingMGRS.spacing(targetData.targetMgrs)}</Badge>
                  <p className="font-medium text-primitive-neutral-0">{targetData.targetName}</p>
                </div>
              </div>
              <div className="flex flex-col gap-1 pl-3">
                {Object.entries(targetData.detachmentData).map(([detachmentId, detachment]) => {
                  return (
                    <div key={detachmentId} className="flex flex-col gap-0.5 mb-4 last:mb-0">
                      <div className="flex flex-col gap-1 text-sm text-primitive-neutral-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center flex-wrap gap-2">
                            <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <p className="font-medium text-primitive-neutral-0">{detachment.detachmentName}</p>
                            {Object.entries(detachment.assetsQuantity).map(([assetId, numbers]) => (
                              <ProgressBadge key={assetId} label={`${uavName(assetId)} × ${numbers.quantity}`} processed={numbers.processed} total={numbers.quantity} />
                            ))}
                          </div>
                          {detachment.reportId ? <ViewReportButton reportId={detachment.reportId} /> : null}
                        </div>
                      </div>
                      {/* <div className="pl-6">
                        <LaunchProgressBadge
                          launches={detachment.launches}
                        />
                      </div> */}
                    </div>
                  );
                })}
              </div>
            </div>
          )
        };
      })
    }
  }, [linkedTasks, linkedTargets, linkedBattleGroups]);

  return (
    <Card
      className={cn(isArchived ? "opacity-60" : "hover:cursor-pointer",)}
      onDoubleClick={() => onPreview(mission)}
    >
      <CardHeader>
        <div className="flex items-center min-w-0 gap-2">
          <p className="truncate text-sm font-semibold text-primitive-neutral-0" title={`${mission.label} ${title}`}>
            {mission.label}
          </p>
          {mission.confirmed_at !== null ? (
            <Badge style={entityStatusBadgeStyle("reported")}>
              {`${DICTIONARY.common.states.reported} + ${DICTIONARY.common.statuses.confirmed}`}
            </Badge>
          ) : (
            <EntityStatusBadge status={getEntityState(mission)} />
          )}
        </div>
        <div onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
          <EditIconButton onClick={() => navigate(`/planning/missions/${mission.id}`)} />
          {/* <PreviewIconButton onClick={() => onPreview(mission)} /> */}
        </div>
      </CardHeader>
      <CardBody className="gap-3">
        <div className="flex flex-col gap-1 mb-4">
          <p className="flex items-center gap-1 text-sm text-primitive-neutral-200">
            <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
            <Badge className="bg-primitive-neutral-800 text-[18px]">{formatDateUk(mission.scheduled_at)}</Badge>
            {title.trim() ? null : (
              <>
                <span>—</span>
                <span className="line-clamp-2" title={title}>
                  {title}
                </span>
              </>
            )}
          </p>
          <p className="line-clamp-2 text-sm text-primitive-neutral-300" title={mission.description}>
            {mission.description}
          </p>
        </div>
        <div className="flex flex-col gap-2 min-h-14">
          {linkedTasks.length === 0 ? (
            <Badge className="w-fit bg-primitive-red-500/20 font-medium text-primitive-red-500">
              {DICTIONARY.missions.no_tasks_assigned}
            </Badge>
          ) : groupedTargets?.map((target) => target.section)}
        </div>
      </CardBody>
      <CardFooter className="flex-col items-stretch gap-2">
        <div className="flex items-center justify-between gap-2">
          <div onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
            {isArchived ? (
              <ResetIconButton onClick={() => onRestore(mission)} />
            ) : (
              <ArchiveIconButton onClick={() => onArchive(mission)} />
            )}
          </div>
          <Button
            variant="ghost"
            className="h-8 px-2"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/planning/tasks?missionId=${mission.id}`);
            }}
          >
            <Eye className="h-4 w-4 mr-1" aria-hidden="true" />
            {DICTIONARY.missions.preview_tasks}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
