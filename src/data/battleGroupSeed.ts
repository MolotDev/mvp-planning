import {
  BATTLE_GROUP_1_ID,
  BATTLE_GROUP_2_ID,
  TASK_1_ID,
  TASK_2_ID,
} from "@/data/missionSeed";
import type { BattleGroup } from "@/types/battleGroup";

export { BATTLE_GROUP_1_ID, BATTLE_GROUP_2_ID };

export function createBattleGroupSeed(now = new Date()): BattleGroup[] {
  const iso = now.toISOString();
  return [
    {
      id: BATTLE_GROUP_1_ID,
      task_id: TASK_1_ID,
      lead_crew_id: "1.1.1",
      support_crew_ids: ["1.1.2"],
      asset_id: "uav_1",
      uav_quantity: 4,
      created_at: iso,
      updated_at: iso,
      archived_at: null,
    },
    {
      id: BATTLE_GROUP_2_ID,
      task_id: TASK_2_ID,
      lead_crew_id: "2.1.1",
      support_crew_ids: [],
      asset_id: "uav_2",
      uav_quantity: 2,
      created_at: iso,
      updated_at: iso,
      archived_at: null,
    },
  ];
}
