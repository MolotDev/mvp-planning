import { Users } from "lucide-react";
import { entityStatusBadgeStyle } from "@/components/reports/reportStatusBadge";
import { Badge, ProgressBadge, TargetBadge,  } from "@/components/ui/badge";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DICTIONARY } from "@/constants/dictionary";
import { isToday } from "@/lib/dates";
import { getEntityState } from "@/lib/entityState";
import type { Mission, Task } from "@/types/mission";
import type { Target } from "@/types/target";
import { formattingMGRS } from "@/lib/formattingMGRS";
import { allocationsForMission, taskBelongsToMission } from "@/lib/taskAllocations";
import { cn } from "@/lib/utils";
import { detachmentName } from "@/lib/detachments";
import { useReportStore } from "@/store/useReportStore";
import { matchingReports } from "@/lib/reportAggregation";
import { uavName } from "@/lib/battleGroup";
import { countProcessedLaunches } from "@/lib/launches";
import { useMemo } from "react";
import { useLaunchStore } from "@/store/useLaunchStore";
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
  onPreview: (mission: Mission) => void;
  focusTargetId?: string;
  displayLabel?: string;
  displayTitle?: string;
}

export function MissionCard({
  mission,
  tasks,
  targets,
  onPreview,
  focusTargetId = "",
  displayLabel,
  displayTitle,
}: MissionCardProps) {
  const reports = useReportStore((state) => state.reports);
  const launches = useLaunchStore((state) => state.launches);
  const linkedTasks = tasks.filter((task) => taskBelongsToMission(task, mission));
  const linkedTargets = targets.filter((target) =>
    linkedTasks.some((task) => allocationsForMission(task, mission.id).some((line) => line.target_id === target.id)),
  );
  const detachments = [...new Set(linkedTasks.map((task) => task.organization_id).filter(Boolean))] as string[];
  const isArchived = mission.archived_at !== null;
  const title = displayTitle ?? mission.name ?? mission.label;
  const label = displayLabel ?? mission.label;
  const missionDate = mission.scheduled_at;
  const currentMissionReports = matchingReports(reports, detachments, missionDate);

  const groupedTargets = useMemo(() => {
    const dataByTarget = new Map<string, TargetData>();
    linkedTasks.forEach((task) => {
      allocationsForMission(task, mission.id)
        .filter((line) => !focusTargetId || line.target_id === focusTargetId)
        .forEach((line) => {
      const targetId = line.target_id || "unknown";
      const target = linkedTargets.find((item) => item.id === targetId);
      if (!target) return;
      const detachmentId = task.organization_id;
      const lineLaunches = launches.filter(
        (launch) => launch.archived_at === null && launch.allocation_line_id === line.id,
      );
      const processed = countProcessedLaunches(lineLaunches).total;
      const detachmentData = dataByTarget.get(targetId)?.detachmentData ?? {};
      if (!detachmentData[detachmentId]) {
        const reportId = currentMissionReports.find((report) => report.organization_id === detachmentId)?.id ?? ""
        detachmentData[detachmentId] = {
          detachmentName: detachmentName(detachmentId),
          reportId,
          assetsQuantity: {[line.asset_id]: {
            quantity: line.quantity,
            processed,
          }},
          launches: lineLaunches,
        };
      } else {
          detachmentData[detachmentId].assetsQuantity[line.asset_id] ??= {
            quantity: 0,
            processed: 0
          };
          detachmentData[detachmentId].assetsQuantity[line.asset_id].quantity += line.quantity;
          detachmentData[detachmentId].assetsQuantity[line.asset_id].processed += processed;
          detachmentData[detachmentId].launches = [...detachmentData[detachmentId].launches, ...lineLaunches];
      }
      dataByTarget.set(targetId, {
        targetLabel: target?.label ?? "",
        targetMgrs: target?.mgrs ?? "",
        targetName: target?.name ?? "",
        detachmentData,
      });
        });
    });
    if (dataByTarget.size > 0) {
      return [...dataByTarget.entries()].map(([targetId, targetData]) => {
        return {
          section: (
            <div key={targetId} className="flex flex-col gap-3 rounded-lg border border-primitive-neutral-800 p-2 overflow-hidden">
              <div className="flex items-start gap-2">
                <TargetBadge
                  targetId={targetId}
                  mgrs={formattingMGRS.spacing(targetData.targetMgrs)}
                  label={targetData.targetName}
                  targetClasses="text-xs"
                  wrapperClasses="items-start"
                />
              </div>
              <div className="flex flex-col gap-1">
                {Object.entries(targetData.detachmentData).map(([detachmentId, detachment]) => {
                  return (
                    <div key={detachmentId} className="flex flex-col gap-0.5 mb-1 last:mb-0">
                      <div className="flex flex-col gap-1 text-sm text-primitive-neutral-200">
                        <div className="flex items-center">
                          <div className="flex items-center flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
                              <p className="font-medium text-primitive-neutral-300">{detachment.detachmentName}</p>
                            </div>
                            {Object.entries(detachment.assetsQuantity).map(([assetId, numbers]) => (
                              <ProgressBadge key={assetId} label={`${uavName(assetId)} × ${numbers.quantity}`} processed={numbers.processed} total={numbers.quantity} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        };
      })
    }
  }, [focusTargetId, linkedTasks, linkedTargets, launches, mission.id, currentMissionReports]);

  return (
    <Card
      className={cn(
        isArchived ? "opacity-60" : "hover:cursor-pointer",
        isToday(new Date(mission.scheduled_at)) ? "border-primitive-neutral-500 hover:shadow-[0_0_10px_rgba(255,255,255,0.2)] hover:border-primitive-neutral-100 transition-all duration-300" : "")
      }
      onClick={() => onPreview(mission)}
    >
      <CardHeader>
        <div className="flex items-center min-w-0 gap-2 flex-wrap">
          <p className="text-sm font-semibold text-primitive-neutral-0" title={`${label} ${title}`}>
            {label}
          </p>
          {mission.confirmed_at !== null ? (
            <Badge style={entityStatusBadgeStyle("reported")}>
              {`${DICTIONARY.common.states.reported} + ${DICTIONARY.common.statuses.confirmed}`}
            </Badge>
          ) : (
            <EntityStatusBadge status={getEntityState(mission)} />
          )}
        </div>
      </CardHeader>
      <CardBody className="gap-3">
        <div className="flex flex-col gap-0.5 mb-2">
          <p
          className={cn(
            "text-lg text-primitive-neutral-200 overflow-hidden text-ellipsis whitespace-nowrap line-clamp-2",
            isToday(new Date(mission.scheduled_at)) ? "text-primitive-neutral-0" : ""
          )}
          title={title?.trim() || label}>
          {title?.trim() || label}
          </p>
          <p className="text-sm text-primitive-neutral-300 overflow-hidden text-ellipsis whitespace-nowrap line-clamp-2" title={mission.description}>
            {mission.description}
          </p>
        </div>
        <div className="flex flex-col gap-2 min-h-14">
          {linkedTasks.length === 0 ? (
            <Badge className={cn("w-fit bg-primitive-red-500/20 font-medium", !mission.archived_at ? "text-primitive-red-500" : "")}>
              {DICTIONARY.missions.no_tasks_assigned}
            </Badge>
          ) : groupedTargets?.map((target) => target.section)}
        </div>
      </CardBody>
    </Card>
  );
}
