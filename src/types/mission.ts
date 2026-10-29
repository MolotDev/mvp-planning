import type { CancellationMetadata } from "@/types/cancellation";

export type MissionStatusFilter = "active" | "reported" | "archived" | "cancelled" | "all";

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
  cancellation?: CancellationMetadata | null;
}

export type TaskSource = "center" | "detachment";

export interface TaskAllocation {
  id: string;
  mission_id: string;
  target_id: string;
  aiming_point_id: string | null;
  asset_id: string;
  quantity: number;
}

export interface Task {
  id: string;
  label: string;
  organization_id: string;
  mission_id: string | null;
  source: TaskSource;
  scheduled_at: string;
  allocations: TaskAllocation[];
  battle_groups_ids: string[];
  fact_submitted_at: string | null;
  fact_notes: string | null;
  created_at: string;
  updated_at: string;
  reported_at: string | null;
  confirmed_at: string | null;
  archived_at: string | null;
  cancellation?: CancellationMetadata | null;
}

export interface MissionMetrics {
  total: number;
  active: number;
  reported: number;
  archived: number;
}
