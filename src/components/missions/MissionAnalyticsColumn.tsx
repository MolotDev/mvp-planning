import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DICTIONARY } from "@/constants/dictionary";
import { crewsForOrganization, DETACHMENT_REFS } from "@/data/crews";
import { crewName, uavName } from "@/lib/battleGroup";
import { crewWord, fillTemplate } from "@/lib/battleGroupCapacity";
import { equippedCount, launchesForLine, prepTone } from "@/lib/missionDashboard";
import { crewWeekLoads, type CrewDayKind } from "@/lib/taskDashboard";
import { cn } from "@/lib/utils";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Mission, Task } from "@/types/mission";

const dayClassName: Record<CrewDayKind, string> = {
  past: "bg-blue-950/50 text-blue-400 border border-blue-800/60",
  future: "bg-primitive-neutral-800 text-primitive-neutral-300 border border-primitive-neutral-700",
  today: "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-semibold",
};

const statusIcon = {
  ready: "🟢",
  progress: "🟡",
  idle: "⚪",
} as const;

interface MissionAnalyticsColumnProps {
  mission: Mission;
  tasks: Task[];
  groups: BattleGroup[];
  launches: Launch[];
}

export function MissionAnalyticsColumn({ mission, tasks, groups, launches }: MissionAnalyticsColumnProps) {
  const text = DICTIONARY.missions.command;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const now = new Date();
  const related = tasks.filter(
    (task) => task.archived_at === null && task.allocations.some((line) => line.mission_id === mission.id),
  );
  const orgIds = [...new Set(related.map((task) => task.organization_id))];

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {orgIds.map((orgId) => {
        const name = DETACHMENT_REFS.find((item) => item.id === orgId)?.name ?? orgId;
        const roster = crewsForOrganization(orgId);
        const orgTasks = related.filter((task) => task.organization_id === orgId);
        const planned = orgTasks.reduce(
          (sum, task) =>
            sum + task.allocations.filter((line) => line.mission_id === mission.id).reduce((inner, line) => inner + line.quantity, 0),
          0,
        );
        const weeks = roster.map((crew) => crewWeekLoads(crew.id, tasks, groups, launches, now, mission.scheduled_at));
        const days = weeks[0]?.days.map((day, index) => ({
          ...day,
          count: weeks.reduce((sum, week) => sum + (week.days[index]?.count ?? 0), 0),
        })) ?? [];
        const hits = weeks.reduce((sum, week) => sum + week.engagement.hits, 0);
        const total = weeks.reduce((sum, week) => sum + week.engagement.total, 0);
        const rate = total === 0 ? 0 : Math.round((hits / total) * 100);
        const expanded = open[orgId] === true;
        return (
          <article key={orgId} className="flex flex-col gap-3 rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 p-3">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-semibold text-primitive-neutral-0">{name}</h2>
              <p className="text-xs text-primitive-neutral-200">{fillTemplate(text.analytics_success, { rate })}</p>
            </div>
            <p className="text-xs text-primitive-neutral-300">
              {fillTemplate(text.analytics_subtitle, { planned, crews: roster.length, crew_word: crewWord(roster.length) })}
            </p>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => (
                <div key={day.key} className="flex min-w-0 flex-col items-center gap-1">
                  <span className="text-[10px] text-primitive-neutral-400">{day.label}</span>
                  {day.count > 0 ? (
                    <span className={cn("rounded px-1 py-0.5 text-xs", dayClassName[day.kind])}>{day.count}</span>
                  ) : (
                    <span className="text-center text-[10px] leading-3 text-primitive-neutral-500">
                      {DICTIONARY.tasks.details.no_launches_day}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              className="justify-between border border-primitive-neutral-700"
              aria-expanded={expanded}
              onClick={() => setOpen((current) => ({ ...current, [orgId]: !expanded }))}
            >
              {text.expand_crews}
              <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
            </Button>
            {expanded ? (
              <ul className="flex flex-col gap-1">
                {roster.map((crew) => {
                  const crewGroups = groups.filter(
                    (group) =>
                      group.archived_at === null &&
                      group.lead_crew_id === crew.id &&
                      orgTasks.some((task) => task.id === group.task_id),
                  );
                  const assigned = orgTasks.reduce((sum, task) => {
                    return (
                      sum +
                      task.allocations
                        .filter((line) => line.mission_id === mission.id)
                        .reduce((inner, line) => {
                            const sameAssetCount = task.allocations.filter(
                              (item) => item.mission_id === line.mission_id && item.asset_id === line.asset_id,
                            ).length;
                            const quantity = crewGroups
                            .filter(
                              (group) =>
                                group.task_id === task.id &&
                                (group.allocation_line_id === line.id ||
                                  (group.allocation_line_id == null &&
                                    group.asset_id === line.asset_id &&
                                    sameAssetCount === 1)),
                            )
                            .reduce((groupSum, group) => groupSum + group.uav_quantity, 0);
                          return inner + quantity;
                        }, 0)
                    );
                  }, 0);
                  const crewLaunches = orgTasks.flatMap((task) =>
                    task.allocations
                      .filter((line) => line.mission_id === mission.id)
                      .flatMap((line) =>
                        launchesForLine(task, line, launches).filter((launch) =>
                          crewGroups.some((group) => group.id === launch.battle_group_id),
                        ),
                      ),
                  );
                  const prepped = equippedCount(crewLaunches);
                  const assets = [...new Set(crewGroups.map((group) => uavName(group.asset_id)).filter(Boolean))];
                  const crewRate = crewWeekLoads(crew.id, tasks, groups, launches, now, mission.scheduled_at).engagement.rate;
                  const tone = assigned === 0 ? "idle" : prepTone(prepped, assigned);
                  return (
                    <li key={crew.id} className="text-xs text-primitive-neutral-200">
                      {fillTemplate(text.crew_line, {
                        code: crewName(crew.id),
                        asset: assets.join(", ") || DICTIONARY.tasks.details.empty_value,
                        rate: crewRate,
                        prepped,
                        assigned,
                        status: statusIcon[tone],
                      })}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
