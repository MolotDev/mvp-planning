import { DETACHMENT_REFS } from "@/data/crews";
import { DICTIONARY } from "@/constants/dictionary";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { formatDateUk, formatTimeUk } from "@/lib/dates";
import { formattingMGRS } from "@/lib/formattingMGRS";
import type { Mission, Task, TaskAllocation } from "@/types/mission";
import type { AimingPoint, Target } from "@/types/target";
import { Button } from "../ui/button";
import { PanelRightClose } from "lucide-react";

interface TaskInfoDrawerProps {
  task: Task;
  missions: Mission[];
  targets: Target[];
  aimingPoints: AimingPoint[];
  onClose: () => void;
}

function lineLabel(line: TaskAllocation, targets: Target[], aimingPoints: AimingPoint[]): { name: string; mgrs: string } {
  const target = targets.find((item) => item.id === line.target_id);
  const point = line.aiming_point_id
    ? aimingPoints.find((item) => item.id === line.aiming_point_id && item.archived_at === null)
    : undefined;
  const mgrs = point?.mgrs || target?.mgrs || "";
  return {
    name: point?.name || target?.name || DICTIONARY.tasks.allocation.primary_target,
    mgrs: mgrs ? formattingMGRS.spacing(mgrs) : DICTIONARY.tasks.details.empty_value,
  };
}

export function TaskInfoDrawer({ task, missions, targets, aimingPoints, onClose }: TaskInfoDrawerProps) {
  const text = DICTIONARY.tasks.details;
  const missionIds = [...new Set(task.allocations.map((line) => line.mission_id))];
  const related = missionIds.flatMap((id) => {
    const mission = missions.find((item) => item.id === id);
    return mission ? [mission] : [];
  });
  const detachment = DETACHMENT_REFS.find((item) => item.id === task.organization_id);
  const origins = related.map((mission) => [mission.label, mission.name].filter(Boolean).join(" — ")).filter(Boolean);
  const notes = task.fact_notes?.trim() ?? "";
  const scheduledAt = task.scheduled_at || task.created_at;

  return (
    // <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
    <div className="absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l border-primitive-neutral-800 bg-primitive-neutral-900 shadow-2xl" role="presentation">
      {/* <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" /> */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-info-title"
        className="relative z-10 flex h-full w-full flex-col border-l border-primitive-neutral-800 bg-primitive-neutral-900 shadow-lg"
      >
        <header className="flex items-center justify-between gap-3 border-b border-primitive-neutral-800 px-4 py-3">
          <h2 id="task-info-title" className="text-base font-semibold text-primitive-neutral-0">
            {text.task_info}
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
          {/* <CloseIconButton onClick={onClose} /> */}
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          <section className="flex flex-col gap-1.5">
            <h3 className="text-xs font-medium text-primitive-neutral-300">{text.drawer_description}</h3>
            <p className="whitespace-pre-wrap text-sm text-primitive-neutral-0">
              {related.map((mission) => mission.description.trim()).filter(Boolean).join("\n\n") || text.empty_value}
            </p>
          </section>
          <section className="flex flex-col gap-1.5">
            <h3 className="text-xs font-medium text-primitive-neutral-300">{text.drawer_origin}</h3>
            <p className="text-sm text-primitive-neutral-0">
              {[detachment?.name, ...origins].filter(Boolean).join(" · ") || text.empty_value}
            </p>
          </section>
          <section className="flex flex-col gap-1.5">
            <h3 className="text-xs font-medium text-primitive-neutral-300">{text.drawer_mgrs}</h3>
            <ul className="flex flex-col gap-2">
              {task.allocations.map((line) => {
                const point = lineLabel(line, targets, aimingPoints);
                return (
                  <li key={line.id} className="flex flex-col gap-0.5 text-sm text-primitive-neutral-0">
                    <span>{point.name}</span>
                    <span className="font-mono text-xs text-primitive-neutral-300">{point.mgrs}</span>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="flex flex-col gap-1.5">
            <h3 className="text-xs font-medium text-primitive-neutral-300">{text.drawer_window}</h3>
            <p className="text-sm text-primitive-neutral-0">
              {fillTemplate(text.window_value, { date: formatDateUk(scheduledAt), time: formatTimeUk(scheduledAt) })}
            </p>
          </section>
          <section className="flex flex-col gap-1.5">
            <h3 className="text-xs font-medium text-primitive-neutral-300">{text.drawer_notes}</h3>
            <p className="whitespace-pre-wrap text-sm text-primitive-neutral-0">{notes || text.empty_value}</p>
          </section>
        </div>
      </aside>
    </div>
  );
}
