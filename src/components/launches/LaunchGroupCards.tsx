import { Calendar, MapPinned } from "lucide-react";
import { BattleGroupCrewLine } from "@/components/launches/BattleGroupCrewLine";
import { QuantityDiscrepancy } from "@/components/tasks/QuantityDiscrepancy";
import { Badge, TargetIdBadge } from "@/components/ui/badge";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PreviewIconButton } from "@/components/ui/icon-buttons";
import { DICTIONARY } from "@/constants/dictionary";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { formatDateUk } from "@/lib/dates";
import { getEntityState } from "@/lib/entityState";
import { taskAimingPoints } from "@/lib/launchAiming";
import { launchQuantitySummary, type LaunchRowContext } from "@/lib/launchBoard";
import { isLaunchProcessed, quantityDiscrepancy } from "@/lib/launches";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { cn } from "@/lib/utils";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Mission, Task } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";
import { formattingMGRS } from "@/lib/formattingMGRS";

export interface LaunchCardScope {
  id: string;
  task: Task;
  mission: Mission | undefined;
  target: Target | undefined;
  battleGroup?: BattleGroup;
  battleGroups?: BattleGroup[];
  launches: Launch[];
}

interface LaunchGroupCardsProps {
  scopes: LaunchCardScope[];
  aimingPoints: AimingPoint[];
  onPreview: (scope: LaunchCardScope) => void;
}

export function launchPreviewPath(scope: LaunchCardScope): string {
  if (scope.battleGroup) {
    return `/planning/launches/${scope.battleGroup.id}`;
  }
  const groupIds = [...new Set(scope.launches.map((launch) => launch.battle_group_id))];
  if (groupIds.length === 1) {
    return `/planning/launches/${groupIds[0]}`;
  }
  return `/planning/launches/task/${scope.task.id}`;
}

export function LaunchGroupCards({ scopes, aimingPoints, onPreview }: LaunchGroupCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {scopes.map((scope) => (
        <LaunchScopeCard key={scope.id} scope={scope} aimingPoints={aimingPoints} onPreview={onPreview} />
      ))}
    </div>
  );
}

function LaunchScopeCard({
  scope,
  aimingPoints,
  onPreview,
}: {
  scope: LaunchCardScope;
  aimingPoints: AimingPoint[];
  onPreview: (scope: LaunchCardScope) => void;
}) {
  const launches = useLaunchStore((state) => state.launches);
  const battleGroups = useBattleGroupStore((state) => state.battleGroups);
  const entityState = getEntityState(scope.task);
  const groups = scope.battleGroup
    ? [scope.battleGroup]
    : battleGroups.filter((group) => scope.launches.some((launch) => launch.battle_group_id === group.id));
  const missionName = scope.mission?.name?.trim() ? scope.mission.name : (scope.target?.name ?? "");
  const scheduledAt = scope.mission?.scheduled_at ?? scope.task.created_at;
  const points = taskAimingPoints(scope.task, aimingPoints);
  const summary = launchQuantitySummary(scope.launches);

  const assigned = scope.launches.filter(
    (launch) =>
      launch.archived_at === null &&
      isLaunchProcessed(launch),
  );
  const isAllAssigned = assigned.length === scope.launches.length;

  return (
    <Card className="min-w-[320px] hover:cursor-pointer" onDoubleClick={() => onPreview(scope)}>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-semibold text-primitive-neutral-0">{scope.task.label}</span>
          <EntityStatusBadge status={entityState} />
        </div>
        <PreviewIconButton onClick={() => onPreview(scope)} />
      </CardHeader>
      <CardBody className="gap-3">
        <p className="flex flex-wrap items-center gap-1 text-primitive-neutral-200">
          <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
          <Badge className="bg-primitive-neutral-800 text-[18px]">{formatDateUk(scheduledAt)}</Badge>
          {missionName ? (
            <>
              <span>—</span>
              <span className="line-clamp-2 text-sm" title={missionName}>
                {missionName}
              </span>
            </>
          ) : null}
        </p>
        {scope.target ? (
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <MapPinned className="h-4 w-4 shrink-0" aria-hidden="true" />
            <TargetIdBadge className="text-sm">{scope.target.displayed_id || scope.target.label}</TargetIdBadge>
            <span>{scope.target.name}</span>
            <Badge className="bg-primitive-neutral-800 text-primitive-neutral-0">{formattingMGRS.spacing(scope.target.mgrs)}</Badge>
          </div>
        ) : null}
        {scope.battleGroup ? <BattleGroupCrewLine group={scope.battleGroup} /> : null}
        {groups.map((group) => {
          const discrepancy = quantityDiscrepancy(group.uav_quantity, launches, group.id);
          return discrepancy ? (
            <QuantityDiscrepancy key={group.id} planned={discrepancy.planned} actual={discrepancy.actual} />
          ) : null;
        })}
        <p className="text-md text-primitive-neutral-200">
          {fillTemplate(DICTIONARY.tasks.launch_board.total_launches, { summary })}
        </p>
        <div className="flex flex-col gap-2">
          {!points.length && (
            <div className={cn("flex flex-col gap-1 rounded-md border p-2", isAllAssigned ? "border-primitive-neutral-800" : "border-red-800")}>
              <p className="text-sm text-primitive-neutral-200">
                {fillTemplate(DICTIONARY.tasks.launch_board.processed_launches, {
                  summary: launchQuantitySummary(assigned),
                })}
              </p>
            </div>
          )}
          {points.map((point) => {
            return (
              <div key={point.id} className={cn("flex flex-col gap-1 rounded-md border p-2", isAllAssigned ? "border-primitive-neutral-800" : "border-red-800")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-1 text-[14px] font-semibold">
                    <Badge className="text-[12px] font-semibold bg-sky-950">{point.displayed_id || point.label || "—"}</Badge>
                    <span className="text-primitive-neutral-0">{point.name}</span>
                    <Badge className="bg-primitive-neutral-800 text-[12px] font-semibold text-primitive-neutral-0">
                      {formattingMGRS.spacing(point.mgrs)}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-primitive-neutral-200">
                  {fillTemplate(DICTIONARY.tasks.launch_board.processed_launches, {
                    summary: launchQuantitySummary(assigned),
                  })}
                </p>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

export function scopesFromRows(rows: LaunchRowContext[], mode: "battle_group" | "task"): LaunchCardScope[] {
  const map = new Map<string, LaunchCardScope>();
  const setOfBattleGroups = new Set<BattleGroup>();
  // const processedAimingPoints = new Set<string>(rows.map((row) => row.launch.aiming_point_mgrs ? row.aimingPoint?.id ?? '' : ''));
  let id = ""
  rows.forEach((row) => {
    if (!row.task) {
      return;
    }
    id = mode === "battle_group" ? row.launch.battle_group_id : row.task.id;
    row.battleGroup && setOfBattleGroups.add(row.battleGroup);
    const existing = map.get(id);
    if (existing) {
      existing.launches.push(row.launch);
      return;
    }
    map.set(id, {
      id,
      task: row.task, //{...row.task, aiming_point_ids: row.task.aiming_point_ids.filter((id) => processedAimingPoints.has(id))},
      mission: row.mission,
      target: row.target,
      battleGroup: mode === "battle_group" ? row.battleGroup : undefined,
      launches: [row.launch],
    });
  });
  if (mode === "task") {
    map.forEach((scope) => {
      scope.battleGroups = [...setOfBattleGroups].filter((group) => scope.launches.some((launch) => launch.battle_group_id === group.id));
    });
  }
  return [...map.values()];
}
