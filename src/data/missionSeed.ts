// import { AP_1_ID, AP_3_ID, TARGET_1_ID, TARGET_2_ID } from "@/data/targetSeed";
import { calculateDateOffset } from "@/lib/dates";
import type { Mission, Task } from "@/types/mission";

export const MISSION_1_ID = "c1111111-1111-4111-8111-111111111111";
export const MISSION_2_ID = "c2222222-2222-4222-8222-222222222222";
export const MISSION_3_ID = "c3333333-3333-4333-8333-333333333333";
export const TASK_1_ID = "d1111111-1111-4111-8111-111111111111";
export const TASK_2_ID = "d2222222-2222-4222-8222-222222222222";
export const TASK_3_ID = "d3333333-3333-4333-8333-333333333333";
export const ALLOCATION_1_ID = "aa111111-1111-4111-8111-111111111111";
export const ALLOCATION_2_ID = "aa222222-2222-4222-8222-222222222222";
export const ALLOCATION_3_ID = "aa333333-3333-4333-8333-333333333333";
export const BATTLE_GROUP_1_ID = "e1111111-1111-4111-8111-111111111111";
export const BATTLE_GROUP_2_ID = "e2222222-2222-4222-8222-222222222222";
export const BATTLE_GROUP_3_ID = "e3333333-3333-4333-8333-333333333333";

export function createMissionSeed(now = new Date()): { missions: Mission[]; tasks: Task[] } {
  const tasks: Task[] = [
    {
      id: TASK_1_ID,
      label: "TK-1",
      organization_id: "detachment_3",
      mission_id: null,
      source: "center",
      scheduled_at: calculateDateOffset(now, -2),
      allocations: [],
      battle_groups_ids: [BATTLE_GROUP_3_ID],
      fact_submitted_at: null,
      fact_notes: null,
      created_at: calculateDateOffset(now, -3),
      updated_at: calculateDateOffset(now, -2),
      reported_at: null,
      confirmed_at: null,
      archived_at: calculateDateOffset(now, -2),
    },
    // {
    //   id: TASK_2_ID,
    //   label: "TK-2",
    //   organization_id: "detachment_2",
    //   mission_id: MISSION_2_ID,
    //   source: "center",
    //   scheduled_at: calculateDateOffset(now, -1),
    //   allocations: [
    //     {
    //       id: ALLOCATION_2_ID,
    //       mission_id: MISSION_2_ID,
    //       target_id: TARGET_2_ID,
    //       aiming_point_id: AP_3_ID,
    //       asset_id: "uav_2",
    //       quantity: 2,
    //     },
    //   ],
    //   battle_groups_ids: [BATTLE_GROUP_2_ID],
    //   fact_submitted_at: null,
    //   fact_notes: null,
    //   created_at: calculateDateOffset(now, -2),
    //   updated_at: calculateDateOffset(now, -1),
    //   reported_at: null,
    //   archived_at: null,
    // },
    // {
    //   id: TASK_3_ID,
    //   label: "TK-3",
    //   organization_id: "detachment_1",
    //   mission_id: MISSION_3_ID,
    //   source: "center",
    //   scheduled_at: calculateDateOffset(now, 0),
    //   allocations: [
    //     {
    //       id: ALLOCATION_1_ID,
    //       mission_id: MISSION_3_ID,
    //       target_id: TARGET_1_ID,
    //       aiming_point_id: AP_1_ID,
    //       asset_id: "uav_1",
    //       quantity: 4,
    //     },
    //   ],
    //   battle_groups_ids: [BATTLE_GROUP_1_ID],
    //   fact_submitted_at: null,
    //   fact_notes: null,
    //   created_at: calculateDateOffset(now, -1),
    //   updated_at: calculateDateOffset(now, 0),
    //   reported_at: null,
    //   archived_at: null,
    // },
  ];

  const missions: Mission[] = [
    {
      id: MISSION_1_ID,
      label: "MN-1",
      name: "Перехоплення Бета",
      scheduled_at: calculateDateOffset(now, -2),
      description: "Архівна місія перехоплення",
      task_ids: [],
      created_at: calculateDateOffset(now, -3),
      updated_at: calculateDateOffset(now, -2),
      reported_at: null,
      confirmed_at: null,
      archived_at: calculateDateOffset(now, -2),
    },
    // {
    //   id: MISSION_2_ID,
    //   label: "MN-2",
    //   name: "Заграва",
    //   scheduled_at: calculateDateOffset(now, -1),
    //   description: "Зниження спроможностей",
    //   task_ids: [TASK_2_ID],
    //   created_at: calculateDateOffset(now, -2),
    //   updated_at: calculateDateOffset(now, -1),
    //   reported_at: null,
    //   confirmed_at: null,
    //   archived_at: null,
    // },
    // {
    //   id: MISSION_3_ID,
    //   label: "MN-3",
    //   name: "Килим",
    //   scheduled_at: calculateDateOffset(now, 0),
    //   description: "Відволікання уваги",
    //   task_ids: [TASK_3_ID],
    //   created_at: calculateDateOffset(now, -1),
    //   updated_at: calculateDateOffset(now, 0),
    //   reported_at: null,
    //   confirmed_at: null,
    //   archived_at: null,
    // },
  ];

  return { missions, tasks };
}
