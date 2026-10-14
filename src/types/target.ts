export const TARGET_TYPES = ["ППО", "КСП", "Склад БК", "Жива сила"] as const;

export type TargetType = (typeof TARGET_TYPES)[number];

export interface Target {
  id: string;
  label: string;
  displayed_id: string;
  name: string;
  address: string;
  type: string;
  distance_from_hot_line: number;
  mgrs: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  aiming_point_ids: string[];
  image_url: string | null;
}

export interface AimingPoint {
  id: string;
  target_id: string;
  label: string;
  displayed_id: string;
  name: string;
  mgrs: string;
  agl_msl: number;
  feat_hgt_msl: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export type StatusFilter = "active" | "archived" | "all";

export type EntityStatus = "active" | "archived" | "reported";

export interface TargetFormValues {
  displayed_id: string;
  name: string;
  address: string;
  type: string;
  mgrs: string;
  distance_from_hot_line: string;
  image_url: string;
}

export interface AimingPointFormValues {
  displayed_id: string;
  name: string;
  mgrs: string;
  feat_hgt_msl: string;
  agl_msl: string;
}
