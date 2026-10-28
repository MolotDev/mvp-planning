import { Eye, RadarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DICTIONARY } from "@/constants/dictionary";
import { crewName, uavName } from "@/lib/battleGroup";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { isLaunchEquipped } from "@/lib/taskCrewMatrix";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Task } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";
import { findAimingPointByRef } from "@/lib/aimingPointCode";
import { formatAimingPointRef } from "@/lib/formatters";
import { AimingPointBadge, ProgressBadge } from "../ui/badge";

interface LaunchSummaryCardsProps {
  task: Task;
  targets: Target[];
  aimingPoints: AimingPoint[];
  groups: BattleGroup[];
  launches: Launch[];
  onOpen: (selection: { crewId: string; assetId: string }) => void;
  routesEditable?: boolean;
  routeDrafts?: Record<string, string>;
  onRouteChange?: (launchId: string, value: string) => void;
}

interface AimingSummary {
  id: string;
  label: string;
  mgrs: string;
  ready: number;
  total: number;
}

interface CrewAssetSummary {
  key: string;
  crewId: string;
  assetId: string;
  ready: number;
  trackers: number;
  total: number;
  points: AimingSummary[];
  launchIds: string[];
}

export function LaunchSummaryCards({
  task,
  targets,
  aimingPoints,
  groups,
  launches,
  onOpen,
  routesEditable = false,
  routeDrafts,
  onRouteChange,
}: LaunchSummaryCardsProps) {
  const text = DICTIONARY.tasks.details;
  const taskLaunches = launches.filter((launch) => launch.archived_at === null && launch.task_id === task.id);
  const summaryMap = new Map<string, CrewAssetSummary>();
  groups
    .filter((group) => group.archived_at === null && group.task_id === task.id)
    .forEach((group) => {
      const allocation =
        task.allocations.find((line) => line.id === group.allocation_line_id) ??
        task.allocations.find((line) => line.asset_id === group.asset_id);
      const target = targets.find((item) => item.id === allocation?.target_id);
      const point = findAimingPointByRef(aimingPoints, allocation?.aiming_point_id, allocation?.target_id);
      const groupLaunches = taskLaunches.filter((launch) => launch.battle_group_id === group.id);
      const key = `${group.lead_crew_id}:${group.asset_id}`;
      const current = summaryMap.get(key) ?? {
        key,
        crewId: group.lead_crew_id,
        assetId: group.asset_id,
        ready: 0,
        trackers: 0,
        total: 0,
        points: [],
        launchIds: [],
      };
      const ready = groupLaunches.filter(isLaunchEquipped).length;
      const pointId = point?.id ?? allocation?.aiming_point_id ?? allocation?.target_id ?? group.id;
      const aiming = formatAimingPointRef(
        allocation?.aiming_point_id,
        aimingPoints,
        target?.name,
        allocation?.target_id,
      );
      const existingPoint = current.points.find((item) => item.id === pointId);
      if (existingPoint) {
        existingPoint.ready += ready;
        existingPoint.total += groupLaunches.length;
      } else {
        current.points.push({
          id: pointId,
          label: aiming.label,
          mgrs: aiming.badge,
          ready,
          total: groupLaunches.length,
        });
      }
      current.ready += ready;
      current.trackers += groupLaunches.filter((launch) => Boolean(launch.tracker_model_serial_number?.trim())).length;
      current.total += groupLaunches.length;
      groupLaunches.forEach((launch) => {
        if (!current.launchIds.includes(launch.id)) {
          current.launchIds.push(launch.id);
        }
      });
      summaryMap.set(key, current);
    });
  const summaries = [...summaryMap.values()];

  if (summaries.length === 0) {
    return <p className="text-sm text-primitive-neutral-300">{DICTIONARY.tasks.no_crews_assigned}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {summaries.map((summary) => (
        <article
          key={summary.key}
          className="flex flex-col gap-2 rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-sm font-medium text-primitive-neutral-300">
              {fillTemplate(text.crew_summary_heading, {crew: crewName(summary.crewId)})}
            </h3>
            {/* <ProgressBadge label={`${uavName(summary.assetId)} • ${summary.ready} / ${summary.total}`} processed={summary.ready} total={summary.total} />
            <span className="py-1 text-xs text-primitive-neutral-300">
              {fillTemplate(text.tracker_count, { ready: summary.trackers, total: summary.total })}
            </span> */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                className="border border-primitive-neutral-700 h-7"
                disabled={summary.total === 0}
                onClick={() =>
                  onOpen({
                    crewId: summary.crewId,
                    assetId: summary.assetId,
                  })
                }
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                {text.open_launches}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {summary.points.map((point) => (
              <div key={point.id} className="flex justify-between gap-2">
                <AimingPointBadge mgrs={point.mgrs} label={point.label} />
                <ProgressBadge
                  label={`${uavName(summary.assetId)} • ${point.ready} / ${point.total}`}
                  processed={point.ready}
                  total={point.total}
                  className="w-fit whitespace-nowrap h-fit"
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RadarIcon className="h-4 w-4 text-zinc-300/50 mt-1" />
            <span className="text-sm text-primitive-neutral-300">
              {fillTemplate(text.tracker_count, { ready: summary.trackers, total: summary.total })}
            </span>
          </div>
          <details className="border border-primitive-neutral-800 rounded-md flex flex-col">
            <summary className="text-md text-primitive-neutral-300 cursor-pointer bg-primitive-neutral-800 px-2 rounded-md">
              {fillTemplate(text.trajectories, {
                ready: summary.launchIds.filter((launchId) => {
                  const stored = launches.find((launch) => launch.id === launchId)?.trajectory_name ?? "";
                  return (routeDrafts?.[launchId] ?? stored).trim().length > 0;
                }).length,
                total: 3,
              })}
            </summary>
            <div className="flex flex-col gap-2 p-3">
              {[0, 1, 2].map((index) => {
                const launchId = summary.launchIds[index];
                const launch = launches.find((item) => item.id === launchId);
                const label = fillTemplate(text.route_label, { index: index + 1 });
                const value = launch ? (routeDrafts?.[launch.id] ?? launch.trajectory_name ?? "") : "";
                if (routesEditable && launch && onRouteChange) {
                  return (
                    <Input
                      key={launch.id}
                      aria-label={label}
                      value={value}
                      onChange={(event) => onRouteChange(launch.id, event.target.value)}
                    />
                  );
                }
                return (
                  <span key={launchId ?? `route-${index}`} className="rounded border border-primitive-neutral-700 px-2 py-1 text-xs text-primitive-neutral-200">
                    {`${label} ${value}`}
                  </span>
                );
              })}
            </div>
          </details>
        </article>
      ))}
    </div>
  );
}
