import { DICTIONARY } from "@/constants/dictionary";
import { crewName, uavName } from "@/lib/battleGroup";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { crewClearanceAssetIds, crewWeekLoads } from "@/lib/taskDashboard";
import { cn } from "@/lib/utils";
import type { BattleGroup, Crew } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Task } from "@/types/mission";

const dayClassName = {
  past: "bg-blue-950/50 text-blue-400 border border-blue-800/60",
  future: "bg-primitive-neutral-800 text-primitive-neutral-300 border border-primitive-neutral-700",
  today: "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 font-semibold",
} as const;

interface CrewWorkloadColumnProps {
  crews: Crew[];
  tasks: Task[];
  groups: BattleGroup[];
  launches: Launch[];
  scheduledAt: string;
  highlightedCrewId: string | null;
}

export function CrewWorkloadColumn({
  crews,
  tasks,
  groups,
  launches,
  scheduledAt,
  highlightedCrewId,
}: CrewWorkloadColumnProps) {
  const text = DICTIONARY.tasks.details;
  const now = new Date();

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {crews.map((crew) => {
        const clearance = crewClearanceAssetIds(crew.id, groups).map((id) => uavName(id));
        const { days, engagement } = crewWeekLoads(crew.id, tasks, groups, launches, now, scheduledAt);
        return (
          <article
            key={crew.id}
            id={`crew-load-${crew.id}`}
            className={cn(
              "flex flex-col gap-3 rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 p-3",
              highlightedCrewId === crew.id && "border-primitive-blue-500 ring-2 ring-primitive-blue-500",
            )}
          >
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-medium text-primitive-neutral-0">
                {fillTemplate(text.crew_title, { name: crewName(crew.id) })}
              </h3>
              <p className="text-xs text-primitive-neutral-300">
                {fillTemplate(text.clearance, { list: clearance.join(", ") || text.empty_value })}
              </p>
              <p className="text-xs text-primitive-neutral-200">
                {fillTemplate(text.success_rate, {
                  rate: engagement.rate,
                  hits: engagement.hits,
                  total: engagement.total,
                })}
              </p>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => (
                <div key={day.key} className="flex min-w-0 flex-col items-center gap-1">
                  <span className="text-[10px] text-primitive-neutral-400">{day.label}</span>
                  {day.count > 0 ? (
                    <span className={cn("rounded px-1 py-0.5 text-xs", dayClassName[day.kind])}>{day.count}</span>
                  ) : (
                    <span className="text-center text-[10px] leading-3 text-primitive-neutral-500">{text.no_launches_day}</span>
                  )}
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
