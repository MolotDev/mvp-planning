import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DICTIONARY } from "@/constants/dictionary";
import { crewName } from "@/lib/battleGroup";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { isLaunchEquipped } from "@/lib/taskCrewMatrix";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Task } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";
import { AimingPointBadge, ProgressBadge } from "../ui/badge";

interface LaunchSummaryCardsProps {
  task: Task;
  targets: Target[];
  aimingPoints: AimingPoint[];
  groups: BattleGroup[];
  launches: Launch[];
  onOpen: (selection: { crewId: string; assetId: string; allocationId: string }) => void;
}

export function LaunchSummaryCards({
  task,
  targets,
  aimingPoints,
  groups,
  launches,
  onOpen,
}: LaunchSummaryCardsProps) {
  const text = DICTIONARY.tasks.details;
  const taskLaunches = launches.filter((launch) => launch.archived_at === null && launch.task_id === task.id);
  const summaries = groups
    .filter((group) => group.archived_at === null && group.task_id === task.id)
    .map((group) => {
      const allocation =
        task.allocations.find((line) => line.id === group.allocation_line_id) ??
        task.allocations.find((line) => line.asset_id === group.asset_id);
      const target = targets.find((item) => item.id === allocation?.target_id);
      const point = allocation?.aiming_point_id
        ? aimingPoints.find((item) => item.id === allocation.aiming_point_id && item.archived_at === null)
        : undefined;
      const groupLaunches = taskLaunches.filter((launch) => launch.battle_group_id === group.id);
      return {
        group,
        allocationId: allocation?.id ?? "",
        aiming: point?.name || target?.name || DICTIONARY.tasks.allocation.primary_target,
        mgrs: point?.mgrs ?? target?.mgrs ?? "",
        ready: groupLaunches.filter(isLaunchEquipped).length,
        trackers: groupLaunches.filter((launch) => Boolean(launch.tracker_model_serial_number?.trim())).length,
        total: groupLaunches.length,
      };
    });

  if (summaries.length === 0) {
    return <p className="text-sm text-primitive-neutral-300">{DICTIONARY.tasks.no_crews_assigned}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {summaries.map((summary) => (
        <article
          key={summary.group.id}
          className="flex flex-col gap-2 rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-sm font-medium text-primitive-neutral-300">
              {fillTemplate(text.crew_summary_heading, {crew: crewName(summary.group.lead_crew_id)})}
            </h3>
            <ProgressBadge label={`${crewName(summary.group.lead_crew_id)} • ${summary.ready} / ${summary.total}`} processed={summary.ready} total={summary.total} />
            <span className="py-1 text-xs text-primitive-neutral-300">
              {fillTemplate(text.tracker_count, { ready: summary.trackers, total: summary.total })}
            </span>
            <div className="flex justify-end">
              <Button
                variant="ghost"
                className="border border-primitive-neutral-700 h-8"
                disabled={!summary.allocationId}
                onClick={() =>
                  onOpen({
                    crewId: summary.group.lead_crew_id,
                    assetId: summary.group.asset_id,
                    allocationId: summary.allocationId,
                  })
                }
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                {text.open_launches}
              </Button>
            </div>
          </div>
          <h3 className="text-sm font-medium text-primitive-neutral-300">
            <AimingPointBadge
              mgrs={summary.mgrs}
              label={summary.aiming}
            />
            {/* {fillTemplate(text.crew_summary_heading, {
              crew: crewName(summary.group.lead_crew_id),
              asset: uavName(summary.group.asset_id),
              quantity: summary.group.uav_quantity,
              aiming: summary.aiming,
            })} */}
            {/* {fillTemplate(text.summary_heading, {
              crew: crewName(summary.group.lead_crew_id),
              asset: uavName(summary.group.asset_id),
              quantity: summary.group.uav_quantity,
              aiming: summary.aiming,
            })} */}
          </h3>
          <details open className="border border-primitive-neutral-800 rounded-md flex flex-col">
            <summary className="text-md text-primitive-neutral-300 cursor-pointer bg-primitive-neutral-800 px-2 rounded-md">
              {fillTemplate(text.trajectories, { ready: 0, total: 3 })}
            </summary>
            <div className="flex flex-col gap-2 p-3">
              <span className="rounded border border-primitive-neutral-700 px-2 py-1 text-xs text-primitive-neutral-200">
                Маршрут 1: 
              </span>
              <span className="rounded border border-primitive-neutral-700 px-2 py-1 text-xs text-primitive-neutral-200">
                Маршрут 2:
              </span>
              <span className="rounded border border-primitive-neutral-700 px-2 py-1 text-xs text-primitive-neutral-200">
                Маршрут 3:
              </span>
            </div>
          </details>
        </article>
      ))}
    </div>
  );
}
