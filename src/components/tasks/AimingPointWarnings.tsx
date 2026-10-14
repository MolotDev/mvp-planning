import { AimingPointIdBadge, Badge } from "@/components/ui/badge";
import { DICTIONARY } from "@/constants/dictionary";
import { formattingMGRS } from "@/lib/formattingMGRS";
import { isAimingPointAssigned, taskAimingPoints } from "@/lib/launchAiming";
import { cn } from "@/lib/utils";
import { useLaunchStore } from "@/store/useLaunchStore";
import { useTargetStore } from "@/store/useTargetStore";
import type { Task } from "@/types/mission";
import type { AimingPoint } from "@/types/target";

interface AimingPointWarningsProps {
  tasks: Task[];
}

export function AimingPointWarnings({ tasks }: AimingPointWarningsProps) {
  const aimingPoints = useTargetStore((state) => state.aimingPoints);
  const launches = useLaunchStore((state) => state.launches);
  const rows = tasks.flatMap((task) =>
    taskAimingPoints(task, aimingPoints).map((point) => ({
      point,
      taskId: task.id,
      assigned: isAimingPointAssigned(point, task.id, launches),
    })),
  );
  const unique = new Map<string, { point: AimingPoint; assigned: boolean }>();
  rows.forEach((row) => {
    const current = unique.get(row.point.id);
    if (!current) {
      unique.set(row.point.id, { point: row.point, assigned: row.assigned });
      return;
    }
    if (!row.assigned) {
      unique.set(row.point.id, { point: row.point, assigned: false });
    }
  });

  if (unique.size === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {[...unique.values()].map(({ point, assigned }) => (
        <div key={point.id} className="flex flex-col">
          <div>
            <div className="flex items-center gap-2">
              <AimingPointIdBadge>
                {point.displayed_id || point.label}
              </AimingPointIdBadge>
              <Badge
                className={cn(
                  "text-xs font-semibold tracking-wide bg-primitive-neutral-800"
                )}
              >
                {formattingMGRS.spacing(point.mgrs)}
              </Badge>
            </div>
            <span className="text-[14px] font-semibold text-primitive-neutral-0">{point.name}</span>
          </div>
          {assigned ? null : (
            <p role="alert" className="text-xs text-primitive-red-500 p-0 m-0">
              {DICTIONARY.tasks.aiming_point_unassigned}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
