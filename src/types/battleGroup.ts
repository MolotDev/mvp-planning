export interface Detachment {
  id: string;
  name: string;
}

export interface Crew {
  id: string;
  name: string;
  organization_id: string;
}

export interface BattleGroup {
  id: string;
  task_id: string;
  lead_crew_id: string;
  support_crew_ids: string[];
  asset_id: string;
  uav_quantity: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface BattleGroupInput {
  task_id: string;
  lead_crew_id: string;
  support_crew_ids: string[];
  asset_id: string;
  uav_quantity: number;
}
