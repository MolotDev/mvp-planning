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
import { LaunchProgressBadge } from "../tasks/LaunchProgressBadge";
import { Fragment, useMemo } from "react";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";

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

  const assetBadgesByDetachment = linkedTasks.reduce((acc, task) => {
    return {
      ...acc,
      [task.organization_id]: [...(acc[task.organization_id] || []), ...task.assets.map((asset) => ({
        taskId: task.id,
        key: asset.asset_id,
        label: `${uavName(asset.asset_id)} × ${asset.quantity}`,
      }))],
    };
  }, {} as Record<string, { taskId: string; key: string; label: string; }[]>);

  const groupedTargets = useMemo(() => {
    const map = new Map<string, Task[]>();
    linkedTasks.forEach((task) => {
      const targetId = task.target_ids[0] ?? "unknown";
      const list = map.get(targetId) ?? [];
      list.push(task);
      map.set(targetId, list);
    });
    return [...map.entries()].map(([targetId, groupTasks]) => {
      const target = targets.find((item) => item.id === targetId);
      return {
        targetId,
        section: (
          <div key={targetId} className="flex flex-col gap-2 rounded-lg border border-primitive-neutral-800 p-2">
            <div className="flex items-start gap-2">
              <div className="h-6 flex items-center justify-center">
                <Crosshair className="h-4 w-4 shrink-0" aria-hidden="true" />
              </div>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <TargetIdBadgeLink className="text-md" id={target?.id ?? "-"}>{target?.displayed_id || target?.label || "—"}</TargetIdBadgeLink>
                <Badge className="text-md bg-primitive-neutral-800 min-w-fit">{formattingMGRS.spacing(target?.mgrs ?? "—")}</Badge>
                <p className="font-medium text-primitive-neutral-0">{target?.name ?? "—"}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1 pl-3">
              {groupTasks.map(task => {
                if (!task.target_ids.includes(target?.id ?? "")) return null;
                const assetsQuantity = task.assets.reduce((prev, asset) => {
                  return {
                    ...prev,
                    total: (prev.total ?? 0) + asset.quantity,
                    [asset.asset_id]: (prev[asset.asset_id] ?? 0) + asset.quantity,
                  }
                }, {} as {total: number, [key: string]: number});
                const assetsProcessed = linkedBattleGroups.reduce((prev, battleGroup) => {
                  if (battleGroup.task_id !== task.id) return prev;
                  return {
                    ...prev,
                    total: (prev.total ?? 0) + battleGroup.uav_quantity,
                    [battleGroup.asset_id]: battleGroup.uav_quantity,
                  }
                }, {} as {total: number, [key: string]: number});
                const detachmentId = task.organization_id;
                if (detachments.length === 0) {
                  return (
                    <Fragment key={task.id}>
                      <Badge className="w-fit tracking-wide bg-primitive-red-500/20 font-medium text-primitive-red-500">
                        {DICTIONARY.missions.no_detachments_assigned}
                      </Badge>
                    </Fragment>
                  )
                }
                return (
                  <div key={task.id} className="flex flex-col gap-0.5 mb-4 last:mb-0">
                    <div className="flex flex-col gap-1 text-sm text-primitive-neutral-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <p className="font-medium text-primitive-neutral-0">{detachmentName(detachmentId)}</p>
                          {assetBadgesByDetachment[detachmentId].map((item) => item.taskId === task.id ? (
                            <ProgressBadge key={`${item.taskId}-${item.key}`} label={item.label} processed={assetsProcessed[item.key] ?? 0} total={assetsQuantity[item.key]} />
                          ) : null)}
                        </div>
                        <ViewReportButton reportId={currentMissionReports.find((report) => report.organization_id === detachmentId)?.id ?? ""} />
                      </div>
                    </div>
                    <div className="pl-6">
                      <LaunchProgressBadge
                        launches={launches.filter((launch) => task.id === launch.task_id)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ),
      };
    });
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
          ) : groupedTargets.map((target) => target.section)}
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
            <Eye className="h-4 w-4" aria-hidden="true" />
            {DICTIONARY.missions.preview_tasks}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
