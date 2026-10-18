import { ArrowUpRight, Link2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DICTIONARY } from "@/constants/dictionary";
import { DETACHMENT_REFS } from "@/data/crews";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import { formatDateUk } from "@/lib/dates";
import {
  activeMissionTasks,
  assignedQuantity,
  detachmentTone,
  equippedCount,
  launchesForLine,
  prepSegmentsForLine,
  sumPrepSegments,
  type DetachmentTone,
} from "@/lib/missionDashboard";
import { cn } from "@/lib/utils";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Mission, Task } from "@/types/mission";

const badgeClassName: Record<DetachmentTone, string> = {
  ready: "border border-emerald-800/60 bg-emerald-950/60 text-emerald-300",
  needs_allocation: "border border-rose-900/60 bg-rose-950/50 text-rose-300",
  progress: "border border-amber-800/60 bg-amber-950/50 text-amber-300",
};

interface MissionReadinessPanelProps {
  mission: Mission;
  tasks: Task[];
  groups: BattleGroup[];
  launches: Launch[];
}

export function MissionReadinessPanel({ mission, tasks, groups, launches }: MissionReadinessPanelProps) {
  const navigate = useNavigate();
  const text = DICTIONARY.missions.command;
  const related = activeMissionTasks(mission, tasks);
  const lines = related.flatMap((task) =>
    task.allocations.filter((line) => line.mission_id === mission.id).map((line) => ({ task, line })),
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
  const barTotal = segments.prepped + segments.partial + segments.untouched + segments.unallocated;
  const widths = [
    { key: "prepped", count: segments.prepped, className: "bg-emerald-500", label: text.segment_prepped },
    { key: "partial", count: segments.partial, className: "bg-amber-500", label: text.segment_partial },
    { key: "untouched", count: segments.untouched, className: "bg-slate-500", label: text.segment_untouched },
    { key: "unallocated", count: segments.unallocated, className: "bg-rose-500", label: text.segment_unallocated },
  ];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-primitive-neutral-0">{text.readiness_summary_title}</h2>
      <p className="text-sm text-primitive-neutral-0">
        {`${fillTemplate(text.plan, { total: planned })} │ ${fillTemplate(text.assigned, { assigned, total: planned })} │ ${fillTemplate(text.prepped, { prepped, total: planned })}`}
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
      <div className="flex flex-col gap-3">
        <p className="text-sm text-primitive-neutral-200">
          {fillTemplate(text.flight_tasks, { date: formatDateUk(mission.scheduled_at) })}
        </p>
        {orgIds.map((orgId) => {
          const task = related.find((item) => item.organization_id === orgId);
          const orgLines = lines.filter((item) => item.task.organization_id === orgId);
          const orgPlanned = orgLines.reduce((sum, item) => sum + item.line.quantity, 0);
          const orgAssigned = orgLines.reduce((sum, item) => sum + assignedQuantity(item.task, item.line, groups), 0);
          const orgPrepped = orgLines.reduce(
            (sum, item) => sum + equippedCount(launchesForLine(item.task, item.line, launches)),
            0,
          );
          const tone = detachmentTone(orgAssigned, orgPrepped, orgPlanned);
          const name = DETACHMENT_REFS.find((item) => item.id === orgId)?.name ?? orgId;
          const toneLabel =
            tone === "ready" ? text.badge_ready : tone === "needs_allocation" ? text.badge_needs : text.badge_progress;
          return (
            <div key={orgId} className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-sm text-primitive-neutral-0">
                  {fillTemplate(text.detachment_order, { name, total: orgPlanned })}
                </span>
                <Badge className={cn("w-fit rounded-md", badgeClassName[tone])} title={toneLabel}>
                  {fillTemplate(text.detachment_prepped, { done: orgPrepped, total: orgPlanned })}
                </Badge>
              </div>
              {task ? (
                <Button
                  variant="ghost"
                  className="border border-primitive-neutral-700"
                  onClick={() => navigate(`/planning/tasks/${task.id}`)}
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  {fillTemplate(text.open_task, { label: task.label })}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
