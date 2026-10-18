import { PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DICTIONARY } from "@/constants/dictionary";
import { crewName, uavName } from "@/lib/battleGroup";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { assetShortName, crewHeatmap } from "@/lib/taskDashboard";
import { cn } from "@/lib/utils";
import type { BattleGroup, Crew } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Task } from "@/types/mission";

interface CrewStatsDrawerProps {
  crews: Crew[];
  tasks: Task[];
  groups: BattleGroup[];
  launches: Launch[];
  highlightedCrewId: string | null;
  onClose: () => void;
}

export function CrewStatsDrawer({
  crews,
  tasks,
  groups,
  launches,
  highlightedCrewId,
  onClose,
}: CrewStatsDrawerProps) {
  const text = DICTIONARY.tasks.details;
  const rows = crewHeatmap(
    crews.map((crew) => crew.id),
    tasks,
    groups,
    launches,
    new Date(),
  );

  return (
    <aside
      className="absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l border-primitive-neutral-800 bg-primitive-neutral-900/95 shadow-2xl backdrop-blur"
      role="dialog"
      aria-modal="false"
      aria-labelledby="crew-stats-title"
    >
      <header className="flex items-center justify-between gap-3 border-b border-primitive-neutral-800 px-4 py-3">
        <h2 id="crew-stats-title" className="text-sm font-semibold text-primitive-neutral-0">
          {text.crew_stats_title}
        </h2>
        <Button
          variant="ghost"
          className="h-8 w-8 rounded-full px-0"
          title={text.close_stats}
          aria-label={text.close_stats}
          onClick={onClose}
        >
          <PanelRightClose className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-primitive-neutral-800 text-primitive-neutral-400">
              <th scope="col" className="px-2 py-2 font-medium">{text.heat_crew}</th>
              {rows[0]?.days.map((day) => (
                <th
                  key={day.key}
                  scope="col"
                  className={cn(
                    "px-2 py-2 text-center font-medium",
                    day.today && "bg-primitive-blue-500/20 font-bold text-primitive-blue-500",
                  )}
                >
                  {day.today ? fillTemplate(text.heat_today, { date: day.label }) : day.label}
                </th>
              ))}
              <th scope="col" className="px-2 py-2 text-right font-medium">{text.heat_success}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.crewId}
                id={`crew-load-${row.crewId}`}
                className={cn(
                  "border-b border-primitive-neutral-800",
                  highlightedCrewId === row.crewId && "bg-primitive-blue-500/10",
                )}
              >
                <th scope="row" className="px-2 py-2 text-left font-medium text-primitive-neutral-0">
                  {crewName(row.crewId)}
                </th>
                {row.days.map((day) => (
                  <td
                    key={day.key}
                    className={cn("px-2 py-2 text-center", day.today && "bg-primitive-blue-500/5 font-semibold")}
                  >
                    {day.assets.length === 0 ? (
                      <span className="text-primitive-neutral-500">{text.empty_value}</span>
                    ) : (
                      <span className="inline-flex flex-col gap-0.5">
                        {day.assets.map((asset) => (
                          <span key={asset.assetId}>
                            {`${assetShortName(uavName(asset.assetId))}*(`}
                            <span className="text-primitive-neutral-400">{asset.total}</span>
                            {"/"}
                            <span className="font-medium text-emerald-500">{asset.successful}</span>
                            {"/"}
                            <span className="font-medium text-rose-500">{asset.problematic}</span>
                            {")"}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                ))}
                <td className="px-2 py-2 text-right text-primitive-neutral-0">
                  {row.successRate === null ? text.empty_value : fillTemplate(text.heat_rate, { rate: row.successRate })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </aside>
  );
}
