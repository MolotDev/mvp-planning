export type ReportStatus = "draft" | "submitted" | "archived";

export type ReportStatusFilter = ReportStatus | "all";

export interface Trajectory {
  id: string;
  table_id: string;
  name: string;
  battle_group_id: string;
  asset_id: string;
  distance: number;
  trajectory_height: string;
  height_above_hot_point: string;
  hot_point_cross_line: string;
  duration: string;
  time_on_target: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface LaunchTrajectoryLink {
  launch_id: string;
  trajectory_id: string;
  launch_number: number;
  launched_at: string;
}

export interface CheckpointUpdate {
  battle_group_id: string;
  checkpoint_id: string;
  updated_at: string;
  comment: string;
}

export interface ActualEvent {
  id: string;
  time: string;
  date: string;
  event_description: string;
  comment: string;
}

export interface Report {
  id: string;
  organization_id: string;
  report_date: string;
  analysis_timestamp: string;
  status: ReportStatus;
  commander_summary: string | null;
  planning_participants: string | null;
  adjacent_units_participants: string | null;
  trajectories: Trajectory[];
  launches_by_trajectory: LaunchTrajectoryLink[];
  checkpoint_updates: CheckpointUpdate[];
  actual_events: ActualEvent[];
  images: string[];
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  submitted_at: string | null;
}

export interface ReportMetrics {
  total_missions_count: number;
  total_tasks_count: number;
  total_launches_count: number;
  successful_launches_count: number;
  cancelled_launches_count: number;
  failed_launches_count: number;
  success_rate: number;
  fail_rate: number;
}

export interface ReportListMetrics {
  total: number;
  submitted: number;
  draft: number;
  archived: number;
}
