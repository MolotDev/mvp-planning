import { Pencil } from "lucide-react";
import { AimingPointBadge, Badge, ProgressBadge, TargetBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DICTIONARY } from "@/constants/dictionary";
import { DETACHMENT_REFS } from "@/data/crews";
import { uavName } from "@/lib/battleGroup";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { formattingMGRS } from "@/lib/formattingMGRS";
import {
  activeMissionTasks,
  assignedQuantity,
  equippedCount,
  launchesForLine,
  linePrepState,
  type LinePrepState,
} from "@/lib/missionDashboard";
import { cn } from "@/lib/utils";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Mission, Task } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";

const statusClassName: Record<LinePrepState, string> = {
  ready: "border border-emerald-800/60 bg-emerald-950/60 text-emerald-300",
  progress: "border border-amber-800/60 bg-amber-950/50 text-amber-300",
  queued: "border border-primitive-neutral-700 bg-primitive-neutral-800 text-primitive-neutral-300",
  needs_crew: "border border-rose-900/60 bg-rose-950/50 text-rose-300",
};

interface MissionAllocationBoardProps {
  mission: Mission;
  tasks: Task[];
  launches: Launch[];
  targets: Target[];
  aimingPoints: AimingPoint[];
  groups: BattleGroup[];
  canEdit: boolean;
  onEdit: () => void;
}

export function MissionAllocationBoard({
  mission,
  tasks,
  launches,
  targets,
  aimingPoints,
  groups,
  canEdit,
  onEdit,
}: MissionAllocationBoardProps) {
  const text = DICTIONARY.missions.command;
  const related = activeMissionTasks(mission, tasks);
  const targetOrder: string[] = [];
  related.forEach((task) => {
    task.allocations
      .filter((line) => line.mission_id === mission.id)
      .forEach((line) => {
        if (!targetOrder.includes(line.target_id)) {
          targetOrder.push(line.target_id);
        }
      });
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-primitive-neutral-0">{text.fire_title}</h2>
        {canEdit ? (
          <Button variant="ghost" className="border border-primitive-neutral-700" onClick={onEdit}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {DICTIONARY.missions.edit_toggle}
          </Button>
        ) : null}
      </div>
      {targetOrder.length === 0 ? (
        <p className="text-sm text-primitive-neutral-300">{DICTIONARY.missions.no_detachments_assigned}</p>
      ) : (
        targetOrder.map((targetId) => {
          const target = targets.find((item) => item.id === targetId);
          const rows = related.flatMap((task) =>
            task.allocations
              .filter((line) => line.mission_id === mission.id && line.target_id === targetId)
              .map((line) => ({ task, line })),
          );
          return (
            <div key={targetId} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-primitive-neutral-200">{text.target_label}</span>
                {target ? (
                  <TargetBadge
                    targetId={target.id}
                    mgrs={formattingMGRS.spacing(target.mgrs)}
                    label={target.name}
                  />
                ) : (
                  <span className="text-sm text-primitive-neutral-300">{targetId}</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-primitive-neutral-800 text-left text-xs text-primitive-neutral-400">
                      <th className="px-2 py-2 font-medium">{text.column_aiming}</th>
                      <th className="px-2 py-2 font-medium">{text.column_detachment}</th>
                      <th className="px-2 py-2 font-medium">{text.column_asset}</th>
                      <th className="px-2 py-2 font-medium">{text.column_status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ task, line }) => {
                      const point = line.aiming_point_id
                        ? aimingPoints.find((item) => item.id === line.aiming_point_id && item.archived_at === null)
                        : undefined;
                      const mgrs = formattingMGRS.spacing(point?.mgrs || target?.mgrs || "");
                      const detachment =
                        DETACHMENT_REFS.find((item) => item.id === task.organization_id)?.name ?? task.organization_id;
                      const lineLaunches = launchesForLine(task, line, launches);
                      const prepped = equippedCount(lineLaunches);
                      const assigned = assignedQuantity(task, line, groups);
                      const state = linePrepState(prepped, assigned, line.quantity);
                      const status =
                        state === "ready"
                          ? fillTemplate(text.row_ready, { done: prepped, total: line.quantity })
                          : state === "progress"
                            ? fillTemplate(text.row_progress, { done: prepped, total: line.quantity })
                            : state === "queued"
                              ? fillTemplate(text.row_queued, { total: line.quantity })
                              : fillTemplate(text.row_needs_crew, { quantity: line.quantity });
                      return (
                        <tr key={line.id} className="border-b border-primitive-neutral-800">
                          <td className="px-2 py-2">
                            <AimingPointBadge
                              label={point?.name || target?.name || DICTIONARY.tasks.allocation.primary_target}
                              mgrs={mgrs || DICTIONARY.tasks.details.empty_value}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Badge className="w-fit rounded-md border border-primitive-neutral-700 bg-primitive-neutral-800 text-primitive-neutral-100">
                              {detachment}
                            </Badge>
                          </td>
                          <td className="px-2 py-2">
                            <ProgressBadge label={uavName(line.asset_id)} processed={prepped} total={line.quantity} />
                          </td>
                          <td className="px-2 py-2">
                            <Badge className={cn("w-fit rounded-md", statusClassName[state])}>{status}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
