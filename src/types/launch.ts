export interface TrackerModel {
  id: string;
  name: string;
}

export interface AmmoModel {
  id: string;
  name: string;
}

export interface LaunchStatusRef {
  id: string;
  name: string;
}

export interface CauseLaunchProblem {
  id: string;
  name: string;
}

export interface Launch {
  id: string;
  task_id: string;
  battle_group_id: string;
  asset_id: string;
  asset_serial_number: string;
  tracker_model_id: string | null;
  tracker_model_serial_number: string | null;
  aiming_point_mgrs: string;
  trajectory_name: string | null;
  ammo_model_id: string;
  ammo_quantity: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  reported_at: string | null;
  reported_at_time: string | null;
  processed_at: string | null;
  launch_status_id: string;
  cause_launch_problem_id: string;
  comments: string;
}

export interface LaunchReportInput {
  asset_serial_number: string;
  tracker_model_id: string;
  tracker_model_serial_number: string;
  aiming_point_mgrs: string;
  ammo_model_id: string;
  ammo_quantity: number;
  launch_status_id: string;
  cause_launch_problem_id: string;
  comments: string;
}
