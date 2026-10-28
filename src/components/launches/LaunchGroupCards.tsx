import { Calendar } from "lucide-react";
import { BattleGroupCrewLine } from "@/components/launches/BattleGroupCrewLine";
import { QuantityDiscrepancy } from "@/components/tasks/QuantityDiscrepancy";
import { Badge, TargetBadge } from "@/components/ui/badge";
import { EntityStatusBadge } from "@/components/ui/entity-status-badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PreviewIconButton } from "@/components/ui/icon-buttons";
import { DICTIONARY } from "@/constants/dictionary";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { formatDateUk } from "@/lib/dates";
import { resolvePlanningEntityState } from "@/lib/entityState";
import { formatStoredAimingPoint } from "@/lib/formatters";
import { resolveLaunchAimingPoint } from "@/lib/launchAiming";
import { launchQuantitySummary, type LaunchRowContext } from "@/lib/launchBoard";
import { isLaunchProcessed, quantityDiscrepancy } from "@/lib/launches";
import { useBattleGroupStore } from "@/store/useBattleGroupStore";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useMissionStore } from "@/store/useMissionStore";
import { useTaskStore } from "@/store/useTaskStore";
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
  const tasks = useTaskStore((state) => state.tasks);
  const missions = useMissionStore((state) => state.missions);
  const battleGroups = useBattleGroupStore((state) => state.battleGroups);
  const liveTask = tasks.find((item) => item.id === scope.task.id) ?? scope.task;
  const liveMission =
    (scope.mission ? missions.find((item) => item.id === scope.mission?.id) : undefined) ?? scope.mission;
  const liveLaunches = scope.launches.map(
    (item) => launches.find((launch) => launch.id === item.id) ?? item,
  );
  const entityState = resolvePlanningEntityState(liveTask, liveMission, ...liveLaunches);
  const groups = scope.battleGroups?.length
    ? scope.battleGroups
    : scope.battleGroup
      ? [scope.battleGroup]
      : battleGroups.filter((group) => liveLaunches.some((launch) => launch.battle_group_id === group.id));
  const crewLines = groups.filter((group, index) => {
    const key = `${group.lead_crew_id}|${group.support_crew_ids.join(",")}`;
    return groups.findIndex((item) => `${item.lead_crew_id}|${item.support_crew_ids.join(",")}` === key) === index;
  });
  const missionName = liveMission?.name?.trim() ? liveMission.name : (scope.target?.name ?? "");
  const scheduledAt = liveMission?.scheduled_at ?? liveTask.created_at;
  const summary = launchQuantitySummary(liveLaunches);
  const pointBuckets = new Map<string, { point: AimingPoint | null; launches: Launch[] }>();
  liveLaunches.forEach((launch) => {
    const group = groups.find((item) => item.id === launch.battle_group_id);
    const point = resolveLaunchAimingPoint(liveTask, launch, group, aimingPoints) ?? null;
    const key = point?.id ?? "";
    const bucket = pointBuckets.get(key) ?? { point, launches: [] };
    bucket.launches.push(launch);
    pointBuckets.set(key, bucket);
  });
  const aimingBuckets = [...pointBuckets.values()].sort((left, right) => {
    if (!left.point) {
      return 1;
    }
    if (!right.point) {
      return -1;
    }
    return (left.point.displayed_id || left.point.label).localeCompare(right.point.displayed_id || right.point.label, "uk");
  });

  return (
    <Card className="min-w-[320px] hover:cursor-pointer" onClick={() => onPreview(scope)}>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-semibold text-primitive-neutral-0">{liveTask.label}</span>
          <EntityStatusBadge status={entityState} />
        </div>
        <div onClick={(event) => event.stopPropagation()}>
          <PreviewIconButton onClick={() => onPreview(scope)} />
        </div>
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
          <TargetBadge
            targetId={scope.target.id}
            mgrs={formattingMGRS.spacing(scope.target.mgrs)}
            label={scope.target.name}
            address={scope.target.address}
            targetClasses="text-xs"
            wrapperClasses="items-start"
          />
        ) : null}
        {crewLines.map((group) => (
          <BattleGroupCrewLine key={group.id} group={group} />
        ))}
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
          {aimingBuckets.map((bucket) => {
            const processed = bucket.launches.filter((launch) => launch.archived_at === null && isLaunchProcessed(launch));
            const complete = processed.length === bucket.launches.length && bucket.launches.length > 0;
            const point = bucket.point;
            const aiming = formatStoredAimingPoint(point);
            return (
              <div
                key={point?.id ?? "target"}
                className={cn("flex flex-col gap-1 rounded-md border p-2", complete ? "border-primitive-neutral-800" : "border-red-800")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-1 text-[14px] font-semibold">
                    <Badge className="bg-sky-950 text-[12px] font-semibold">{aiming.badge}</Badge>
                    <span className="text-primitive-neutral-0">{aiming.label}</span>
                  </div>
                </div>
                <p className="text-sm text-primitive-neutral-200">
                  {fillTemplate(DICTIONARY.tasks.launch_board.processed_launches, {
                    summary: launchQuantitySummary(processed),
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

function crewAssetScopeId(row: LaunchRowContext): string {
  const crewId = row.battleGroup?.lead_crew_id;
  const assetId = row.battleGroup?.asset_id ?? row.launch.asset_id;
  if (!row.task || !crewId) {
    return row.launch.battle_group_id;
  }
  return `${row.task.id}:${crewId}:${assetId}`;
}

export function scopesFromRows(rows: LaunchRowContext[], mode: "battle_group" | "task"): LaunchCardScope[] {
  const map = new Map<string, LaunchCardScope>();
  rows.forEach((row) => {
    if (!row.task) {
      return;
    }
    const id = mode === "battle_group" ? crewAssetScopeId(row) : row.task.id;
    const existing = map.get(id);
    if (existing) {
      existing.launches.push(row.launch);
      if (row.battleGroup && !existing.battleGroups?.some((group) => group.id === row.battleGroup?.id)) {
        existing.battleGroups = [...(existing.battleGroups ?? []), row.battleGroup];
      }
      if (existing.target && row.target && existing.target.id !== row.target.id) {
        existing.target = undefined;
      }
      return;
    }
    map.set(id, {
      id,
      task: row.task,
      mission: row.mission,
      target: row.target,
      battleGroup: mode === "battle_group" ? row.battleGroup : undefined,
      battleGroups: row.battleGroup ? [row.battleGroup] : [],
      launches: [row.launch],
    });
  });
  return [...map.values()];
}
