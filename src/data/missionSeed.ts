import { AP_1_ID, AP_3_ID, TARGET_1_ID, TARGET_2_ID } from "@/data/targetSeed";
import type { Mission, Task } from "@/types/mission";

export const MISSION_1_ID = "c1111111-1111-4111-8111-111111111111";
export const MISSION_2_ID = "c2222222-2222-4222-8222-222222222222";
export const TASK_1_ID = "d1111111-1111-4111-8111-111111111111";
export const TASK_2_ID = "d2222222-2222-4222-8222-222222222222";
export const BATTLE_GROUP_1_ID = "e1111111-1111-4111-8111-111111111111";
export const BATTLE_GROUP_2_ID = "e2222222-2222-4222-8222-222222222222";

function startOfDayIso(date: Date): string {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString();
}

export function createMissionSeed(now = new Date()): { missions: Mission[]; tasks: Task[] } {
  const today = startOfDayIso(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = startOfDayIso(tomorrowDate);
  const pastDate = new Date(now);
  pastDate.setDate(pastDate.getDate() - 7);
  const past = pastDate.toISOString();
  const archivedAt = now.toISOString();

  const tasks: Task[] = [
    {
      id: TASK_1_ID,
      label: "TK-1",
      mission_id: MISSION_1_ID,
      target_ids: [TARGET_1_ID],
      aiming_point_id: AP_1_ID,
      organization_id: "detachment_1",
      asset_id: "uav_1",
      quantity: 4,
      battle_groups_ids: [BATTLE_GROUP_1_ID],
      created_at: today,
      updated_at: today,
      reported_at: null,
      archived_at: null,
    },
    {
      id: TASK_2_ID,
      label: "TK-2",
      mission_id: MISSION_1_ID,
      target_ids: [TARGET_2_ID],
      aiming_point_id: AP_3_ID,
      organization_id: "detachment_2",
      asset_id: "uav_2",
      quantity: 2,
      battle_groups_ids: [BATTLE_GROUP_2_ID],
      created_at: today,
      updated_at: today,
      reported_at: null,
      archived_at: null,
    },
  ];

  const missions: Mission[] = [
    {
      id: MISSION_1_ID,
      label: "MN-1",
      name: "Заграва",
      scheduled_at: tomorrow,
      description: "Зниження спроможностей противника",
      task_ids: [TASK_1_ID, TASK_2_ID],
      created_at: today,
      updated_at: today,
      reported_at: null,
      confirmed_at: null,
      archived_at: null,
    },
    {
      id: MISSION_2_ID,
      label: "MN-2",
      name: "Перехоплення Бета",
      scheduled_at: today,
      description: "Архівна місія перехоплення резервів противника.",
      task_ids: [],
      created_at: past,
      updated_at: archivedAt,
      reported_at: null,
      confirmed_at: null,
      archived_at: archivedAt,
    },
  ];

  return { missions, tasks };
}
