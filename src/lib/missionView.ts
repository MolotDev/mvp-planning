import type { Mission, Task } from "@/types/mission";
import type { Target } from "@/types/target";

export type MissionViewMode = "daily" | "target";

export interface TargetMissionCard {
  mission: Mission;
  targetId: string;
  label: string;
  title: string;
  createdAt: string;
}

export function missionTargetIds(mission: Mission, tasks: Task[]): string[] {
  const ids: string[] = [];
  tasks.forEach((task) => {
    task.allocations.forEach((line) => {
      if (line.mission_id !== mission.id || !line.target_id || ids.includes(line.target_id)) {
        return;
      }
      ids.push(line.target_id);
    });
  });
  return ids;
}

export function splitMissionsByTarget(
  missions: Mission[],
  tasks: Task[],
  targets: Target[],
): TargetMissionCard[] {
  const cards: TargetMissionCard[] = [];
  missions.forEach((mission) => {
    const ids = missionTargetIds(mission, tasks);
    const missionTitle = mission.name?.trim() || mission.label;
    if (ids.length === 0) {
      cards.push({
        mission,
        targetId: "",
        label: mission.label,
        title: missionTitle,
        createdAt: mission.created_at,
      });
      return;
    }
    ids.forEach((targetId, index) => {
      const targetName = targets.find((target) => target.id === targetId)?.name?.trim() ?? "";
      cards.push({
        mission,
        targetId,
        label: ids.length > 1 ? `${mission.label}.${index + 1}` : mission.label,
        title: targetName ? `${missionTitle} — ${targetName}` : missionTitle,
        createdAt: mission.created_at,
      });
    });
  });
  return cards.sort((left, right) => {
    const byCreated = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    return byCreated || left.label.localeCompare(right.label);
  });
}
