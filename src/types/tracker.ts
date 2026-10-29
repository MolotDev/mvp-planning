export type TrackerStatus = "available" | "assigned" | "expended";

export interface Tracker {
  id: string;
  number: string;
  status: TrackerStatus;
  assigned_mission_id: string | null;
  assigned_task_id: string | null;
  assigned_launch_id: string | null;
  assigned_asset_id: string | null;
}

export const TRACKER_POOL_SIZE = 40;
export const TRACKER_STORE_KEY = "trackers_pool";
