import { supabase } from "@/lib/supabase";
import type { Launch, LaunchExecutionStatus } from "@/types/launch";

export interface LaunchPublishPayload {
  id: string;
  task_id: string;
  battle_group_id: string;
  allocation_line_id: string | null;
  launch_order: number;
  asset_id: string;
  asset_serial_number: string;
  tracker_model_id: string | null;
  tracker_model_serial_number: string | null;
  aiming_point_mgrs: string;
  trajectory_name: string | null;
  ammo_model_id: string;
  ammo_quantity: number;
  launch_status_id: string;
  comments: string;
  execution_status: LaunchExecutionStatus | null;
}

export interface LaunchPublishResult {
  ok: boolean;
  message?: string;
}

function toPayload(launch: Launch): LaunchPublishPayload {
  return {
    id: launch.id,
    task_id: launch.task_id,
    battle_group_id: launch.battle_group_id,
    allocation_line_id: launch.allocation_line_id,
    launch_order: launch.launch_order,
    asset_id: launch.asset_id,
    asset_serial_number: launch.asset_serial_number,
    tracker_model_id: launch.tracker_model_id,
    tracker_model_serial_number: launch.tracker_model_serial_number,
    aiming_point_mgrs: launch.aiming_point_mgrs,
    trajectory_name: launch.trajectory_name,
    ammo_model_id: launch.ammo_model_id,
    ammo_quantity: launch.ammo_quantity,
    launch_status_id: launch.launch_status_id,
    comments: launch.comments,
    execution_status: launch.execution_status,
  };
}

export async function publishLaunchesToSupabase(launches: Launch[]): Promise<LaunchPublishResult> {
  if (launches.length === 0) {
    return { ok: true };
  }
  if (!supabase) {
    const message = "Не задано VITE_SUPABASE_URL або VITE_SUPABASE_ANON_KEY.";
    console.error("Не вдалося зберегти наряд пусків у Supabase:", message);
    return { ok: false, message };
  }
  try {
    const { error } = await supabase.from("launches").upsert(launches.map(toPayload), { onConflict: "id" });
    if (error) {
      console.error("Не вдалося зберегти наряд пусків у Supabase:", error.message);
      return { ok: false, message: error.message };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Мережа недоступна.";
    console.error("Не вдалося зберегти наряд пусків у Supabase:", message);
    return { ok: false, message };
  }
}
