import { crewName } from "@/lib/battleGroup";
import { getEntityState } from "@/lib/entityState";
import { supabase } from "@/lib/supabase";
import { useTargetStore } from "@/store/useTargetStore";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Mission, Task } from "@/types/mission";
import type {
  BattleGroupPlanRow,
  LaunchPlanRow,
  LaunchPlanStatus,
  MissionPlanRow,
  MissionPlanStatus,
  MissionPlanTree,
  TaskPlanRow,
} from "@/types/plan";

export interface PlanSyncResult {
  ok: boolean;
  message?: string;
  plan?: MissionPlanTree;
}

export async function saveCompleteMissionPlan(payload: {
  mission: Mission;
  tasks: Task[];
  battleGroups: BattleGroup[];
  launches: Launch[];
}): Promise<PlanSyncResult> {
  if (!supabase) {
    return fail("Не задано VITE_SUPABASE_URL або VITE_SUPABASE_ANON_KEY.", "зберегти");
  }
  const client = supabase;
  const missionRow = toMissionRow(payload.mission);
  const launchTaskIds = new Set(
    payload.launches.filter((launch) => launch.archived_at === null).map((launch) => launch.task_id),
  );
  const taskRows = payload.tasks
    .filter((task) => task.archived_at === null || launchTaskIds.has(task.id))
    .map((task) => toTaskRow(task, missionRow.id));
  const taskIds = new Set(taskRows.map((task) => task.id));
  const referencedGroupIds = new Set(
    payload.launches.filter((launch) => launch.archived_at === null).map((launch) => launch.battle_group_id),
  );
  const activeGroups = payload.battleGroups.filter(
    (group) => taskIds.has(group.task_id) && (group.archived_at === null || referencedGroupIds.has(group.id)),
  );
  const groupRows = activeGroups.map(toBattleGroupRow);
  const launchRows = payload.launches
    .filter((launch) => launch.archived_at === null && taskIds.has(launch.task_id))
    .map((launch) => toLaunchRow(launch, missionRow.id, activeGroups));

  const missionResult = await upsertRows(client, "missions", [missionRow]);
  if (!missionResult.ok) {
    return missionResult;
  }
  const taskResult = await upsertRows(client, "tasks", taskRows);
  if (!taskResult.ok) {
    return taskResult;
  }
  const groupResult = await upsertRows(client, "battle_groups", groupRows);
  if (!groupResult.ok) {
    return groupResult;
  }
  return upsertRows(client, "launches", launchRows);
}

export async function loadCompleteMissionPlan(missionId: string): Promise<PlanSyncResult> {
  if (!supabase) {
    return fail("Не задано VITE_SUPABASE_URL або VITE_SUPABASE_ANON_KEY.", "завантажити");
  }
  const client = supabase;
  try {
    const missionResult = await client.from("missions").select("*").eq("id", missionId).maybeSingle();
    if (missionResult.error) {
      return fail(missionResult.error.message, "завантажити");
    }
    const taskResult = await client.from("tasks").select("*").eq("mission_id", missionId);
    if (taskResult.error) {
      return fail(taskResult.error.message, "завантажити");
    }
    const tasks = readRows<TaskPlanRow>(taskResult.data);
    const taskIds = tasks.map((task) => task.id);
    const groupResult =
      taskIds.length === 0
        ? { data: [], error: null }
        : await client.from("battle_groups").select("*").in("task_id", taskIds);
    if (groupResult.error) {
      return fail(groupResult.error.message, "завантажити");
    }
    const launchResult = await client.from("launches").select("*").eq("mission_id", missionId);
    if (launchResult.error) {
      return fail(launchResult.error.message, "завантажити");
    }
    return {
      ok: true,
      plan: {
        mission: readMission(missionResult.data),
        tasks,
        battleGroups: readRows<BattleGroupPlanRow>(groupResult.data),
        launches: readRows<LaunchPlanRow>(launchResult.data),
      },
    };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Мережа недоступна.", "завантажити");
  }
}

function toMissionRow(mission: Mission): MissionPlanRow {
  return {
    id: mission.id,
    name: mission.name?.trim() || mission.label,
    status: missionStatus(mission),
    created_at: mission.created_at,
  };
}

function missionStatus(mission: Mission): MissionPlanStatus {
  const state = getEntityState(mission);
  if (state === "reported" || state === "archived") {
    return "COMPLETED";
  }
  return "ACTIVE";
}

function toTaskRow(task: Task, missionId: string): TaskPlanRow {
  const targets = useTargetStore.getState().targets;
  const allocation = task.allocations[0];
  const target = allocation ? targets.find((item) => item.id === allocation.target_id) : undefined;
  return {
    id: task.id,
    mission_id: task.mission_id || allocation?.mission_id || missionId,
    target_name: target?.name ?? "",
    target_address: target?.address ?? null,
    target_coordinates_mgrs: target?.mgrs ?? null,
    status: getEntityState(task),
  };
}

function toBattleGroupRow(group: BattleGroup): BattleGroupPlanRow {
  const callsign = crewName(group.lead_crew_id).trim();
  return {
    id: group.id,
    task_id: group.task_id,
    lead_crew_id: group.lead_crew_id,
    callsign: callsign || null,
  };
}

function toLaunchRow(launch: Launch, missionId: string, groups: BattleGroup[]): LaunchPlanRow {
  const group = groups.find((item) => item.id === launch.battle_group_id && item.task_id === launch.task_id);
  return {
    id: launch.id,
    mission_id: missionId,
    task_id: launch.task_id,
    battle_group_id: group?.id ?? null,
    lead_crew_id: group?.lead_crew_id ?? "",
    launch_order: launch.launch_order,
    asset_id: launch.asset_id,
    asset_serial_number: launch.asset_serial_number || null,
    tracker_model_id: launch.tracker_model_id || null,
    tracker_model_serial_number: launch.tracker_model_serial_number?.trim() || null,
    aiming_point_mgrs: launch.aiming_point_mgrs || null,
    trajectory_name: launch.trajectory_name,
    status: launchPlanStatus(launch.launch_status_id),
    reported_at: launch.reported_at,
    comments: launch.comments,
  };
}

function launchPlanStatus(launchStatusId: string): LaunchPlanStatus {
  if (launchStatusId === "success") {
    return "SUCCESS";
  }
  if (launchStatusId === "abort") {
    return "ABORT";
  }
  if (launchStatusId === "problem" || launchStatusId === "other") {
    return "PROBLEM";
  }
  return "PLANNED";
}

async function upsertRows(
  client: NonNullable<typeof supabase>,
  table: "missions" | "tasks" | "battle_groups" | "launches",
  rows: object[],
): Promise<PlanSyncResult> {
  if (rows.length === 0) {
    return { ok: true };
  }
  try {
    const { error } = await client.from(table).upsert(rows, { onConflict: "id" });
    if (error) {
      return fail(error.message, "зберегти");
    }
    return { ok: true };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Мережа недоступна.", "зберегти");
  }
}

function readMission(value: unknown): MissionPlanRow | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string") {
    return null;
  }
  const status = row.status === "PLANNING" || row.status === "ACTIVE" || row.status === "COMPLETED" ? row.status : "ACTIVE";
  return {
    id: row.id,
    name: typeof row.name === "string" ? row.name : "",
    status,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

function readRows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function fail(message: string, action: "зберегти" | "завантажити"): PlanSyncResult {
  console.error(`Не вдалося ${action} план місії в Supabase:`, message);
  return { ok: false, message };
}

export async function updateSingleLaunch(launchId: string, updates: Partial<Launch>) {
  if (!supabase) {
    return fail("Не задано VITE_SUPABASE_URL або VITE_SUPABASE_ANON_KEY.", "завантажити");
  }
  const payload = {
    ...(updates.asset_id && { asset_id: updates.asset_id }),
    ...(updates.asset_serial_number !== undefined && { 
      asset_serial_number: updates.asset_serial_number?.trim() || null 
    }),
    ...(updates.tracker_model_id !== undefined && { 
      tracker_model_id: updates.tracker_model_id || null 
    }),
    ...(updates.tracker_model_serial_number !== undefined && { 
      tracker_model_serial_number: updates.tracker_model_serial_number?.trim() || null 
    }),
    ...(updates.aiming_point_mgrs !== undefined && { aiming_point_mgrs: updates.aiming_point_mgrs }),
    ...(updates.trajectory_name !== undefined && { trajectory_name: updates.trajectory_name }),
    status: launchPlanStatus(updates?.launch_status_id ?? "PLANNED"),
  };

  const { data, error } = await supabase
    .from('launches')
    .update(payload)
    .eq('id', launchId)
    .select()
    .single();

  if (error) {
    console.error('Помилка оновлення пуску:', error.message);
    throw error;
  }

  return data;
}
