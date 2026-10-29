import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ListTodo, PlaneIcon, Users } from "lucide-react";
import { AimingPointBadge, Badge, ProgressBadge } from "@/components/ui/badge";
import { PreviewActionButton } from "@/components/ui/preview-action-button";
import { Modal } from "@/components/ui/modal";
import { DICTIONARY } from "@/constants/dictionary";
import { crewName, uavName } from "@/lib/battleGroup";
import { crewWord, fillTemplate } from "@/lib/battleGroupCapacity";
import { formatDateUk } from "@/lib/dates";
import { detachmentName } from "@/lib/detachments";
import { formatStoredAimingPoint } from "@/lib/formatters";
import {
  activeMissionTasks,
  assignedQuantity,
  equippedCount,
  launchesForLine,
  prepSegmentsForLine,
  sumPrepSegments,
} from "@/lib/missionDashboard";
import { allocationsForMission } from "@/lib/taskAllocations";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Mission, Task } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";

interface MissionReadinessPanelProps {
  mission: Mission;
  tasks: Task[];
  groups: BattleGroup[];
  launches: Launch[];
  targets: Target[];
  aimingPoints: AimingPoint[];
}

export function MissionReadinessPanel({
  mission,
  tasks,
  groups,
  launches,
  targets,
  aimingPoints,
}: MissionReadinessPanelProps) {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const text = DICTIONARY.missions.command;
  const related = activeMissionTasks(mission, tasks);
  const lines = related.flatMap((task) =>
    allocationsForMission(task, mission.id).map((line) => ({ task, line })),
  );
  const planned = lines.reduce((sum, item) => sum + item.line.quantity, 0);
  const assigned = lines.reduce((sum, item) => sum + assignedQuantity(item.task, item.line, groups), 0);
  const prepped = lines.reduce((sum, item) => sum + equippedCount(launchesForLine(item.task, item.line, launches)), 0);
  const segments = sumPrepSegments(
    lines.map((item) =>
      prepSegmentsForLine(
        item.line.quantity,
        assignedQuantity(item.task, item.line, groups),
        launchesForLine(item.task, item.line, launches),
      ),
    ),
  );
  const orgIds = [...new Set(related.map((task) => task.organization_id))];
  const crewRows = related.flatMap((task) =>
    groups
      .filter((group) => group.archived_at === null && group.task_id === task.id)
      .flatMap((group) => {
        const missionLines = allocationsForMission(task, mission.id);
        const allocation =
          missionLines.find((line) => line.id === group.allocation_line_id) ??
          missionLines.find((line) => line.asset_id === group.asset_id);
        if (!allocation) {
          return [];
        }
        const target = targets.find((item) => item.id === allocation.target_id);
        const point = allocation.aiming_point_id
          ? aimingPoints.find((item) => item.id === allocation.aiming_point_id)
          : undefined;
        const aiming = formatStoredAimingPoint(point, target?.name);
        const groupLaunches = launches.filter(
          (launch) => launch.archived_at === null && launch.battle_group_id === group.id,
        );
        return [{
          group,
          detachment: detachmentName(task.organization_id),
          aiming: aiming.label ? `${aiming.badge} ${aiming.label}` : aiming.badge,
          aimingBadge: aiming.badge,
          aimingLabel: aiming.label,
          ready: equippedCount(groupLaunches),
          trackers: groupLaunches.filter((launch) => Boolean(launch.tracker_model_serial_number?.trim())).length,
          launches: groupLaunches,
        }];
      }),
  );
  const openRow = crewRows.find((row) => row.group.id === openGroupId);
  const barTotal = segments.prepped + segments.partial + segments.untouched + segments.unallocated;
  const widths = [
    { key: "prepped", count: segments.prepped, className: "bg-emerald-500", label: text.segment_prepped },
    { key: "partial", count: segments.partial, className: "bg-amber-500", label: text.segment_partial },
    { key: "untouched", count: segments.untouched, className: "bg-slate-500", label: text.segment_untouched },
    { key: "unallocated", count: segments.unallocated, className: "bg-red-800", label: text.segment_unallocated },
  ];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 bg-primitive-neutral-900 px-4 py-2 rounded-md border border-primitive-neutral-700">
        <h5 className="text-md font-semibold text-primitive-neutral-300 tracking-wide">{text.readiness_summary_title}</h5>
        <div className="flex gap-6 items-center justify-between">
          <p className="text-sm font-semibold text-primitive-neutral-300 w-fit whitespace-nowrap flex items-center gap-2">
            <PlaneIcon className="h-4 w-4 shrink-0 text-sky-300/50" aria-hidden="true" />
            {fillTemplate(text.assigned, { assigned, total: planned })}
            <ProgressBadge
              label={`${assigned} з ${planned}`}
              processed={assigned}
              total={planned}
              className="text-xs"
            />
          </p>
          <div
            className="flex h-2 w-full overflow-hidden rounded-full bg-primitive-neutral-800"
            role="img"
            aria-label={widths.map((segment) => fillTemplate(segment.label, { count: segment.count })).join(", ")}
          >
            {barTotal > 0
              ? widths.map((segment) =>
                  segment.count > 0 ? (
                    <span
                      key={segment.key}
                      className={cn("h-full", segment.className)}
                      style={{ width: `${(segment.count / barTotal) * 100}%` }}
                      title={fillTemplate(segment.label, { count: segment.count })}
                    />
                  ) : null,
                )
              : null}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-primitive-neutral-300 flex gap-2 items-center">
            <ListTodo className="h-4 w-4 shrink-0 text-sky-300/50" aria-hidden="true" />
            {fillTemplate(text.flight_tasks, { date: formatDateUk(mission.scheduled_at) })}
            <Badge className="bg-primitive-neutral-800 text-md">{formatDateUk(mission.scheduled_at)}</Badge>
          </p>
          {orgIds.map((orgId) => {
            const task = related.find((item) => item.organization_id === orgId);
            const points = related.filter((item) => item.organization_id === orgId).flatMap((item) => item.allocations).length;
            const orgLines = lines.filter((item) => item.task.organization_id === orgId);
            const orgPlanned = orgLines.reduce((sum, item) => sum + item.line.quantity, 0);
            const name = detachmentName(orgId);
            return (
              <div key={orgId} className="flex flex-wrap items-center justify-between gap-2 pl-6 mb-3 last:mb-0">
                <div className="flex min-w-0 items-center gap-x-2 justify-between flex-wrap">
                  <a
                    href={`#/planning/tasks/${task?.id ?? ""}`}
                    title={`${task?.label ?? ""} - Політна заявка. ${name}.`}
                    className="group text-ellipsis whitespace-nowrap flex items-center underline underline-offset-4"
                  >
                    <Badge className="bg-primitive-neutral-800 text-md pt-0.5 pb-1 hover:shadow-[0_0_8px_rgba(214,225,233,0.4)] transition-shadow">
                      <span className="text-sm text-primitive-neutral-0">
                        {`${name}. Політна заявка - ${task?.label ?? ""}`}
                      </span>
                    </Badge>
                    <ArrowUpRight className="w-4 h-4 text-sky-400/70 group-hover:text-sky-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    
                  </a>
                  <span className="text-sm text-primitive-neutral-500">
                    {fillTemplate(text.detachment_order, {total: orgPlanned, points: points })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 bg-primitive-neutral-900 px-4 py-2 rounded-md border border-primitive-neutral-900">
        <h5 className="text-md font-semibold text-primitive-neutral-300 tracking-wide">{text.readiness_summary_title_crews}</h5>
        <div className="flex gap-6 items-center justify-between">
          <p className="text-sm font-semibold text-primitive-neutral-300 w-fit whitespace-nowrap flex items-center gap-2">
            <PlaneIcon className="h-4 w-4 shrink-0 text-sky-300/50" aria-hidden="true" />
            {fillTemplate(text.prepped, { assigned, total: planned })}
            <ProgressBadge
              label={`${prepped} з ${planned}`}
              processed={prepped}
              total={planned}
              className="text-xs"
            />
          </p>
          {role === "CENTER" ? (
            <PreviewActionButton
              label={text.view_all_launches}
              onClick={() => navigate(`/planning/launches/mission/${mission.id}`)}
            />
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-primitive-neutral-300 flex gap-2 items-center">
            <Users className="h-4 w-4 shrink-0 text-sky-300/50" aria-hidden="true" />
            {fillTemplate(text.crew_launches, { count: crewRows.length, crew_word: crewWord(crewRows.length) })}
          </p>
          {crewRows.length === 0 ? (
            <p className="pl-6 text-sm text-primitive-neutral-300">{DICTIONARY.tasks.no_crews_assigned}</p>
          ) : (
            crewRows.map((row) => (
              <div key={row.group.id} className="mb-3 ml-6 flex flex-col gap-2 last:mb-0 border-b border-primitive-neutral-800 last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                  <div className="flex min-w-0 w-full flex-wrap items-center gap-2 justify-between">
                    {!!row.group.id ? (
                      <a
                        href={`#/planning/launches/${row.group.id ?? ""}`}
                        title={`Перейти до пусків екіпажу ${crewName(row.group.lead_crew_id)}.`}
                        className="group text-ellipsis whitespace-nowrap flex items-center underline underline-offset-4"
                      >
                        <Badge className="bg-primitive-neutral-800 text-md pt-0.5 pb-1 hover:shadow-[0_0_8px_rgba(214,225,233,0.4)] transition-shadow">
                          <span className="text-sm text-primitive-neutral-0">
                            {`${crewName(row.group.lead_crew_id)} (${row.detachment}) Пуски`}
                          </span>
                        </Badge>
                        <ArrowUpRight className="w-4 h-4 text-sky-400/70 group-hover:text-sky-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </a>
                    ) : (
                      <Badge className="bg-primitive-neutral-800 text-md pt-0.5 pb-1">
                        <span className="text-sm text-primitive-neutral-0">
                          {`${crewName(row.group.lead_crew_id)} (${row.detachment}) Пуски`}
                        </span>
                      </Badge>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <ProgressBadge
                        label={`${uavName(row.group.asset_id)} × ( ${row.ready} / ${row.group.uav_quantity} )`}
                        processed={row.ready}
                        total={row.group.uav_quantity}
                        className="text-xs"
                      />
                      <span className="text-xs text-primitive-neutral-500">
                        {fillTemplate(DICTIONARY.tasks.details.tracker_count, { ready: row.trackers, total: row.group.uav_quantity })}
                      </span>
                    </div>
                  </div>
                  <AimingPointBadge label={row.aimingLabel} mgrs={row.aimingBadge} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {openRow ? (
        <Modal
          className="max-w-3xl"
          title={fillTemplate(DICTIONARY.tasks.details.launch_modal_title, {
            crew: crewName(openRow.group.lead_crew_id),
            asset: uavName(openRow.group.asset_id),
            target: openRow.aiming,
          })}
          confirmLabel={DICTIONARY.common.actions.close}
          showConfirm={false}
          onClose={() => setOpenGroupId(null)}
          onConfirm={() => setOpenGroupId(null)}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-primitive-neutral-800 text-xs text-primitive-neutral-400">
                  <th scope="col" className="px-2 py-2 font-medium">{DICTIONARY.tasks.details.column_index}</th>
                  <th scope="col" className="px-2 py-2 font-medium">{DICTIONARY.tasks.details.column_trajectory}</th>
                  <th scope="col" className="px-2 py-2 font-medium">{DICTIONARY.tasks.details.column_serial_full}</th>
                  <th scope="col" className="px-2 py-2 font-medium">{DICTIONARY.tasks.details.column_tracker}</th>
                </tr>
              </thead>
              <tbody>
                {openRow.launches.map((launch, index) => (
                  <tr key={launch.id} className="border-b border-primitive-neutral-800">
                    <td className="px-2 py-2 text-primitive-neutral-0">{index + 1}</td>
                    <td className="px-2 py-2 text-primitive-neutral-0">{launch.trajectory_name || DICTIONARY.tasks.details.empty_value}</td>
                    <td className="px-2 py-2 text-primitive-neutral-0">{launch.asset_serial_number.trim() || DICTIONARY.tasks.details.empty_value}</td>
                    <td className="px-2 py-2 text-primitive-neutral-0">{launch.tracker_model_serial_number || DICTIONARY.tasks.details.empty_value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
