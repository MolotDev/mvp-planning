export type AssetStatusFilter = "active" | "reported" | "archived" | "all";

export interface Antenna {
  id: string;
  name: string;
}

export interface Asset {
  id: string;
  label: string;
  antenna_id: string;
  ammo_ids: string[];
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface AssetInput {
  label: string;
  antenna_id: string;
  ammo_ids: string[];
}
