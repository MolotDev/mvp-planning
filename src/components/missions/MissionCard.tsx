import { Calendar, Crosshair, Eye, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { entityStatusBadgeStyle } from "@/components/reports/reportStatusBadge";
import { Badge, TargetIdBadge } from "@/components/ui/badge";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { ViewReportButtons } from "@/components/reports/ViewReportButton";
import { ArchiveIconButton, PreviewIconButton, ResetIconButton } from "@/components/ui/icon-buttons";
import { DICTIONARY } from "@/constants/dictionary";
import { formatDateUk } from "@/lib/dates";
import { getEntityState } from "@/lib/entityState";
import type { Mission, Task } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";
import { formattingMGRS } from "@/lib/formattingMGRS";
import { cn } from "@/lib/utils";
import { detachmentName } from "@/lib/detachments";

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
  aimingPoints,
  onPreview,
  onArchive,
  onRestore,
}: MissionCardProps) {
  const navigate = useNavigate();
  const linkedTasks = tasks.filter((task) => (mission.task_ids ?? []).includes(task.id));
  const linkedTargets = targets.filter((target) =>
    linkedTasks.some((task) => (task.target_ids ?? []).includes(target.id)),
  );
  const firstTarget = linkedTargets[0];
  const firstPoint = aimingPoints.find((point) =>
    linkedTasks.some((task) => (task.aiming_point_ids ?? []).includes(point.id)),
  );
  const detachments = [...new Set(linkedTasks.map((task) => task.organization_id).filter(Boolean))];
  const isArchived = mission.archived_at !== null;
  const title = mission.name ?? mission.label;

  return (
    <Card
      className={cn(isArchived ? "opacity-60" : "hover:cursor-pointer")}
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
          {/* <div className="w-fit">
          </div>
          <p className="truncate text-sm font-semibold text-primitive-neutral-0" title={`${mission.label} ${title}`}>
            {mission.label} {mission.name ? mission.name : ""}
          </p> */}
        </div>
        <div onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
          <PreviewIconButton onClick={() => onPreview(mission)} />
        </div>
      </CardHeader>
      <CardBody className="gap-2">
        <p className="flex items-center gap-1 text-sm text-primitive-neutral-200">
          <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
          <Badge className="bg-primitive-neutral-800 text-[18px]">{formatDateUk(mission.scheduled_at)}</Badge>
          <span>—</span>
          <span className="line-clamp-2" title={title}>
            {title}
          </span>
        </p>
        {linkedTasks.length === 0 ? (
          <Badge className="w-fit bg-primitive-red-500/20 font-medium text-primitive-red-500">
            {DICTIONARY.missions.no_tasks_assigned}
          </Badge>
        ) : (
          <div className="flex items-start gap-1 text-sm">
            <Crosshair className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="line-clamp-2 flex items-center gap-2" title={firstTarget ? `${firstTarget.displayed_id || firstTarget.label} ${firstTarget.name}` : ""}>
              <TargetIdBadge className="text-sm">{firstTarget?.displayed_id || firstTarget?.label || "—"}</TargetIdBadge>
              <span>{firstTarget?.name}</span>
            </p>
          </div>
        )}
        {firstTarget ? (
          <p className="my-3 text-center text-lg font-semibold tracking-wide text-primitive-neutral-0">
            {formattingMGRS.spacing(firstTarget.mgrs)}
          </p>
        ) : firstPoint ? (
          <p className="my-3 text-center text-lg font-semibold tracking-wide text-primitive-neutral-0">
            {firstPoint.mgrs}
          </p>
        ) : null}
        {linkedTasks.length === 0 ? (
          <Badge className="w-fit bg-primitive-red-500/20 font-medium text-primitive-red-500">
            {DICTIONARY.missions.no_detachments_assigned}
          </Badge>
        ) : (
          <p className="flex items-start gap-1 text-sm text-primitive-neutral-200">
            <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2" title={detachments.map((id) => detachmentName(id)).join(", ")}>
              {detachments.map((id) => detachmentName(id)).join(", ")}
            </span>
          </p>
        )}
        <p className="line-clamp-2 text-sm text-primitive-neutral-300" title={mission.description}>
          {mission.description}
        </p>
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
        <div onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
          <ViewReportButtons organizationIds={detachments} scheduledAt={mission.scheduled_at} />
        </div>
      </CardFooter>
    </Card>
  );
}
