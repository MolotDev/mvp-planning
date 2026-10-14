import { Calendar, Crosshair } from "lucide-react";
import { AimingPointWarnings } from "@/components/tasks/AimingPointWarnings";
import { BattleGroupSummaryList } from "@/components/tasks/BattleGroupSummary";
import { QuantityDiscrepancy } from "@/components/tasks/QuantityDiscrepancy";
import { DetachmentAssets } from "@/components/tasks/DetachmentAssets";
import { ViewReportButtons } from "@/components/reports/ViewReportButton";
import { Badge, TargetIdBadge } from "@/components/ui/badge";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
import { PreviewIconButton, ResetIconButton } from "@/components/ui/icon-buttons";
import { canAdminister } from "@/lib/access";
import { visibleBattleGroups } from "@/lib/battleGroup";
import { quantityDiscrepancy } from "@/lib/launches";
import { formatDateUk } from "@/lib/dates";
import { getEntityState } from "@/lib/entityState";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import type { BattleGroup } from "@/types/battleGroup";
import type { Mission, Task } from "@/types/mission";
import type { Target } from "@/types/target";
import { formattingMGRS } from "@/lib/formattingMGRS";

interface TaskCardProps {
  task: Task;
  mission: Mission | undefined;
  target: Target | undefined;
  battleGroups: BattleGroup[];
  onPreview: (task: Task) => void;
  onRestore: (task: Task) => void;
}

export function TaskCard({ task, mission, target, battleGroups, onPreview, onRestore }: TaskCardProps) {
  const role = useAuthStore((state) => state.role);
  const managesTasks = canAdminister(role, "tasks");
  const launches = useLaunchStore((state) => state.launches);
  const entityState = getEntityState(task);
  const assignedGroups = visibleBattleGroups(task, battleGroups);
  const scheduledAt = mission?.scheduled_at ?? task.created_at;
  const missionName = mission?.name ?? mission?.label ?? "";
  const targetTitle = target ? `${target.displayed_id || target.label || "—"} — ${target.name}` : "";

  return (
    <Card className={cn(entityState === "archived" ? "opacity-60" : "hover:cursor-pointer")} onDoubleClick={() => onPreview(task)}>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-semibold text-primitive-neutral-0">{task.label}</span>
          <EntityStatusBadge status={entityState} />
        </div>
        <div onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
          <PreviewIconButton onClick={() => onPreview(task)} />
        </div>
      </CardHeader>
      <CardBody className="gap-2">
        <p className="flex items-center gap-1 text-primitive-neutral-200">
          <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
          <Badge className="bg-primitive-neutral-800 text-[18px]">{formatDateUk(scheduledAt)}</Badge>
          <span>—</span>
          <span className="line-clamp-2 text-sm" title={missionName}>
            {missionName}
          </span>
        </p>
        {target ? (
          <>
            <div className="flex items-start gap-1 text-sm">
              <Crosshair className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="line-clamp-2 flex items-center gap-2" title={targetTitle}>
                <TargetIdBadge className="font-semibold text-sm">{target.displayed_id || target.label || "—"}</TargetIdBadge>
                <span>{target.name}</span>
              </p>
            </div>
            <p className="my-3 text-center text-lg font-semibold tracking-wide text-primitive-neutral-0">
              {formattingMGRS.spacing(target.mgrs)}
            </p>
          </>
        ) : null}
        <AimingPointWarnings tasks={[task]} />
        <DetachmentAssets organizationId={task.organization_id} assets={task.assets} />
        <BattleGroupSummaryList groups={assignedGroups} />
        {assignedGroups.map((group) => {
          const discrepancy = quantityDiscrepancy(group.uav_quantity, launches, group.id);
          return discrepancy ? (
            <QuantityDiscrepancy key={group.id} planned={discrepancy.planned} actual={discrepancy.actual} />
          ) : null;
        })}
      </CardBody>
      <CardFooter>
        <div onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
          {managesTasks && entityState === "archived" && (
            <ResetIconButton onClick={() => onRestore(task)} />
          )}
        </div>
        <div className="ml-auto" onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
          <ViewReportButtons organizationIds={[task.organization_id]} scheduledAt={scheduledAt} />
        </div>
      </CardFooter>
    </Card>
  );
}
