export type AimingPointCode = `MP${string}`;

export type MissionStatus = "ACTIVE" | "COMPLETED" | "ARCHIVED";

export type TaskStatus = "DRAFT" | "PUBLISHED";

export type LaunchStatus = "PLANNED" | "SUCCESS" | "ABORT" | "PROBLEM";

export interface Target {
  id: string;
  external_id: string | null;
  name: string;
  mgrs: string;
  address: string | null;
  created_at: string;
}

export interface Detachment {
  id: string;
  name: string;
}

export interface Platoon {
  id: string;
  detachment_id: string;
  name: string;
}

export interface Crew {
  id: string;
  organization_id: string;
  platoon_id: string;
  name: string;
  is_active: boolean;
}

export interface Mission {
  id: string;
  target_id: string;
  name: string | null;
  scheduled_date: string;
  status: MissionStatus;
  notes: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  mission_id: string;
  detachment_id: string;
  platoon_id: string | null;
  crew_id: string | null;
  asset_id: string;
  aiming_point: AimingPointCode;
  planned_quantity: number;
  status: TaskStatus;
  created_at: string;
}

export interface Launch {
  id: string;
  task_id: string;
  launch_order: number;
  aiming_point: AimingPointCode;
  asset_id: string;
  asset_serial_number: string | null;
  tracker_model_id: string | null;
  tracker_model_serial_number: string | null;
  trajectory_name: string | null;
  ammo_model_id: string | null;
  ammo_quantity: number | null;
  status: LaunchStatus;
  reported_at: string | null;
  actual_launch_time: string | null;
  cause_launch_problem_id: string | null;
  comments: string | null;
  created_at: string;
  updated_at: string;
}

export const PRIMARY_AIMING_POINT = "MP00" as const satisfies AimingPointCode;

export interface MissionPlan {
  mission: Mission;
  tasks: Task[];
  launches: Launch[];
}
