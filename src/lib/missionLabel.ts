import type { Mission } from "@/types/mission";

const DATE_MISSION_LABEL = /^MN-\d{4}-\d{2}-\d{2}$/;
const SEQ_MISSION_LABEL = /^MN-(\d+)$/;

export function nextMissionNumber(missions: Mission[], missionSeq: number): number {
  let max = missionSeq;
  missions.forEach((mission) => {
    if (DATE_MISSION_LABEL.test(mission.label)) {
      return;
    }
    const match = SEQ_MISSION_LABEL.exec(mission.label);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  });
  return max + 1;
}

export function assignSequentialMissionLabels(
  missions: Mission[],
  missionSeq: number,
): { missions: Mission[]; missionSeq: number; changed: boolean } {
  const used = new Set<number>();
  missions.forEach((mission) => {
    if (DATE_MISSION_LABEL.test(mission.label)) {
      return;
    }
    const match = SEQ_MISSION_LABEL.exec(mission.label);
    if (match) {
      used.add(Number(match[1]));
    }
  });
  const replacements = new Map<string, string>();
  missions
    .filter((mission) => DATE_MISSION_LABEL.test(mission.label))
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
    .forEach((mission) => {
      let number = 1;
      while (used.has(number)) {
        number += 1;
      }
      used.add(number);
      replacements.set(mission.id, `MN-${number}`);
    });
  const nextSeq = used.size > 0 ? Math.max(missionSeq, ...used) : missionSeq;
  return {
    missions: replacements.size
      ? missions.map((mission) => {
          const label = replacements.get(mission.id);
          return label ? { ...mission, label } : mission;
        })
      : missions,
    missionSeq: nextSeq,
    changed: replacements.size > 0,
  };
}
