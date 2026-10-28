export type MissionPlanStatus = "PLANNING" | "ACTIVE" | "COMPLETED";

export type LaunchPlanStatus = "PLANNED" | "SUCCESS" | "ABORT" | "PROBLEM";

export interface MissionPlanRow {
  id: string;
  name: string;
  status: MissionPlanStatus;
  created_at?: string;
}

export interface TaskPlanRow {
  id: string;
  mission_id: string;
  target_name: string;
  target_address?: string | null;
  target_coordinates_mgrs?: string | null;
  status: string;
}

export interface BattleGroupPlanRow {
  id: string;
  task_id: string;
  lead_crew_id: string;
  callsign?: string | null;
}

export interface LaunchPlanRow {
  id: string;
  mission_id: string;
  task_id: string;
  battle_group_id: string | null;
  lead_crew_id: string;
  launch_order: number;
  asset_id: string;
  asset_serial_number?: string | null;
  tracker_model_id?: string | null;
  tracker_model_serial_number?: string | null;
  aiming_point_mgrs?: string | null;
  trajectory_name?: string | null;
  status: LaunchPlanStatus;
  reported_at?: string | null;
  comments?: string;
}

export interface MissionPlanTree {
  mission: MissionPlanRow | null;
  tasks: TaskPlanRow[];
  battleGroups: BattleGroupPlanRow[];
  launches: LaunchPlanRow[];
}
