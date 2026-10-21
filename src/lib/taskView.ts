import type { MissionViewMode } from "@/lib/missionView";
import type { Mission, Task } from "@/types/mission";
import type { Target } from "@/types/target";

export type TaskViewMode = MissionViewMode;

export interface TargetTaskCard {
  task: Task;
  targetId: string;
  label: string;
  title: string;
  createdAt: string;
}

export function taskTargetIds(task: Task): string[] {
  const ids: string[] = [];
  task.allocations.forEach((line) => {
    if (!line.target_id || ids.includes(line.target_id)) {
      return;
    }
    ids.push(line.target_id);
  });
  return ids;
}

export function splitTasksByTarget(tasks: Task[], missions: Mission[], targets: Target[]): TargetTaskCard[] {
  const cards: TargetTaskCard[] = [];
  tasks.forEach((task) => {
    const ids = taskTargetIds(task);
    const mission = missions.find((item) => task.allocations.some((line) => line.mission_id === item.id));
    const missionTitle = mission?.name?.trim() || mission?.label || task.label;
    if (ids.length === 0) {
      cards.push({
        task,
        targetId: "",
        label: task.label,
        title: missionTitle,
        createdAt: task.created_at,
      });
      return;
    }
    ids.forEach((targetId, index) => {
      const targetName = targets.find((target) => target.id === targetId)?.name?.trim() ?? "";
      cards.push({
        task,
        targetId,
        label: ids.length > 1 ? `${task.label}.${index + 1}` : task.label,
        title: targetName ? `${missionTitle} — ${targetName}` : missionTitle,
        createdAt: task.created_at,
      });
    });
  });
  return cards.sort((left, right) => {
    const byCreated = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    return byCreated || left.label.localeCompare(right.label);
  });
}
