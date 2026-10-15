export type MissionStatusFilter = "active" | "reported" | "archived" | "all";

export interface UavAsset {
  asset_id: string;
  quantity: number;
}

export interface Mission {
  id: string;
  label: string;
  name: string | null;
  scheduled_at: string;
  description: string;
  task_ids: string[];
  created_at: string;
  updated_at: string;
  reported_at: string | null;
  confirmed_at: string | null;
  archived_at: string | null;
}

export interface Task {
  id: string;
  label: string;
  mission_id: string;
  target_ids: string[];
  aiming_point_id: string | null;
  organization_id: string;
  asset_id: string;
  quantity: number;
  battle_groups_ids: string[];
  created_at: string;
  updated_at: string;
  reported_at: string | null;
  archived_at: string | null;
}

export interface MissionMetrics {
  total: number;
  active: number;
  reported: number;
  archived: number;
}
