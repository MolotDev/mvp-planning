import { Calendar, Pencil } from "lucide-react";
import { AimingPointBadge, Badge, ProgressBadge, TargetBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DICTIONARY } from "@/constants/dictionary";
import { DETACHMENT_REFS } from "@/data/crews";
import { uavName } from "@/lib/battleGroup";
import { formattingMGRS } from "@/lib/formattingMGRS";
import {
  activeMissionTasks,
  launchesForLine,
} from "@/lib/missionDashboard";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Mission, Task } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";
import { formatDateUk } from "@/lib/dates";

// const statusClassName: Record<LinePrepState, string> = {
//   ready: "border border-emerald-800/60 bg-emerald-950/60 text-emerald-300",
//   progress: "border border-amber-800/60 bg-amber-950/50 text-amber-300",
//   queued: "border border-primitive-neutral-700 bg-primitive-neutral-800 text-primitive-neutral-300",
//   needs_crew: "border border-rose-900/60 bg-rose-950/50 text-rose-300",
// };

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
  // groups,
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
      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
            <Badge className="bg-primitive-neutral-800 text-md">{formatDateUk(mission.scheduled_at)}</Badge>
            <h2 className="text-lg font-semibold text-primitive-neutral-0">{mission.name ?? mission.label ?? text.fire_title}</h2>
          </div>
          <p className="text-md text-primitive-neutral-300">{mission.description}</p>
        </div>
        {canEdit ? (
          <Button variant="ghost" className="border border-primitive-neutral-700 flex items-center gap-4" onClick={onEdit}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {DICTIONARY.missions.edit_toggle}
          </Button>
        ) : null}
      </div>
      {targetOrder.length === 0 ? (
        <p className="text-sm text-primitive-neutral-300">{DICTIONARY.missions.no_detachments_assigned}</p>
      ) : (
        <div className="flex flex-col gap-2 mt-4">
          <p className="text-lg font-medium text-primitive-neutral-200">Цілі. Сили та засоби</p>
          {targetOrder.map((targetId) => {
            const target = targets.find((item) => item.id === targetId);
            const rows = related.flatMap((task) =>
              task.allocations
                .filter((line) => line.mission_id === mission.id && line.target_id === targetId)
                .map((line) => ({ task, line })),
            );
            return (
              <div key={targetId} className="flex flex-col gap-2 mb-4 last:mb-0 border-b border-primitive-neutral-800 ">
                <div className="flex flex-wrap items-center">
                  {target ? (
                    <>
                      <TargetBadge
                        targetId={target.id}
                        mgrs={formattingMGRS.spacing(target.mgrs)}
                        label={`${target.name}`}
                      />
                      <span className="text-sm text-primitive-neutral-300 ml-6">{` (${target.address})`}</span>
                    </>
                  ) : (
                    <span className="text-sm text-primitive-neutral-300">{targetId}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2 border-l border-primitive-neutral-700 bg-primitive-neutral-850/40 py-1 pl-3 pr-2">
                  <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="hidden border-b border-primitive-neutral-800 text-left text-xs text-primitive-neutral-400">
                          <th className="px-2 py-2 font-medium">{text.column_aiming}</th>
                          <th className="px-2 py-2 font-medium">{text.column_detachment}</th>
                          <th className="px-2 py-2 font-medium">{text.column_asset}</th>
                          {/* <th className="px-2 py-2 font-medium">Екіпажі</th> */}
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
                        // const prepped = equippedCount(lineLaunches);
                        // const assigned = assignedQuantity(task, line, groups);
                        // const state = linePrepState(prepped, assigned, line.quantity);
                        // const assignedCrews = groups
                        //   .filter((item) => item.asset_id === line.asset_id && item.task_id === task.id)
                        //   .map((item) => crewName(item.lead_crew_id))
                        //   .reduce((acc, crew) => {
                        //     acc[crew] = (acc[crew] || 0) + 1;
                        //     return acc;
                        //   }, {} as Record<string, number>);
                        // const status =
                        //   state === "ready"
                        //     ? fillTemplate(text.row_ready, { done: prepped, total: line.quantity })
                        //     : state === "progress"
                        //       ? fillTemplate(text.row_progress, { done: prepped, total: line.quantity })
                        //       : state === "queued"
                        //         ? fillTemplate(text.row_queued, { total: line.quantity })
                        //         : fillTemplate(text.row_needs_crew, { quantity: line.quantity });
                        return (                          
                          <tr key={line.id} className="border-b border-primitive-neutral-800 last:border-b-0">
                            <td className="py-2">
                              <AimingPointBadge
                                label={point?.name || target?.name || DICTIONARY.tasks.allocation.primary_target}
                                mgrs={mgrs || DICTIONARY.tasks.details.empty_value}
                              />
                            </td>
                            <td className="py-2 !w-20">
                              <ProgressBadge
                                label={detachment}
                                processed={lineLaunches.length}
                                total={line.quantity}
                                className="text-md"
                              />
                            </td>
                            <td className="py-2 !w-24">
                              <Badge className="w-fit rounded-xl bg-primitive-neutral-800 text-primitive-neutral-100 text-ellipsis whitespace-nowrap text-sm">
                                {`${uavName(line.asset_id)} × ${line.quantity}`}
                              </Badge>
                            </td>
                            {/* <td className="py-1">
                              <div className="flex flex-col gap-0.5">
                                {Object.keys(assignedCrews).map((crew) => (
                                  <ProgressBadge
                                    label={`${crew} × ${assigned}`}
                                    processed={prepped}
                                    total={assigned}
                                    className="w-fit text-ellipsis whitespace-nowrap text-xs"
                                  />
                                ))}
                              </div>
                            </td> */}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* <div className="overflow-x-auto">
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
                </div> */}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
