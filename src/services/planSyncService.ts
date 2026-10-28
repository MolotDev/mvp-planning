import { getEntityState } from "@/lib/entityState";
import { planningRepository } from "@/services/planningRepository";
import type { BattleGroup } from "@/types/battleGroup";
import {
  PRIMARY_AIMING_POINT,
  type Launch as LaunchRow,
  type LaunchStatus,
  type Mission as MissionRow,
  type MissionStatus,
  type Task as TaskRow,
} from "@/types/database";
import type { Launch } from "@/types/launch";
import type { Mission, Task } from "@/types/mission";
import type { MissionPlanTree } from "@/types/plan";

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
  const missionTasks = payload.tasks.filter((task) => task.archived_at === null);
  const targetId = missionTargetId(missionTasks);
  if (!targetId) {
    return fail("Не знайдено ціль місії для збереження плану.", "зберегти");
  }
  const missionRow = toMissionRow(payload.mission, targetId);
  const taskIds = new Set(missionTasks.map((task) => task.id));
  const taskRows = missionTasks.map((task) => toTaskRow(task, missionRow.id, payload.battleGroups));
  const launchRows = payload.launches
    .filter((launch) => launch.archived_at === null && taskIds.has(launch.task_id))
    .map(toLaunchRow);

  const plan = await planningRepository.savePlan({
    mission: missionRow,
    tasks: taskRows,
    launches: launchRows,
  });
  return { ok: true, plan: { mission: plan.mission, tasks: plan.tasks, launches: plan.launches } };
}

export async function loadCompleteMissionPlan(missionId: string): Promise<PlanSyncResult> {
  const plan = await planningRepository.loadPlan(missionId);
  return { ok: true, plan: plan ?? { mission: null, tasks: [], launches: [] } };
}

function missionTargetId(tasks: Task[]): string | null {
  for (const task of tasks) {
    const targetId = task.allocations.find((row) => row.target_id)?.target_id;
    if (targetId) {
      return targetId;
    }
  }
  return null;
}

function toMissionRow(mission: Mission, targetId: string): MissionRow {
  return {
    id: mission.id,
    target_id: targetId,
    name: mission.name?.trim() || null,
    scheduled_date: mission.scheduled_at.slice(0, 10),
    status: missionStatus(mission),
    notes: mission.description.trim() || null,
    created_at: mission.created_at,
  };
}

function missionStatus(mission: Mission): MissionStatus {
  const state = getEntityState(mission);
  if (state === "archived") {
    return "ARCHIVED";
  }
  if (state === "reported") {
    return "COMPLETED";
  }
  return "ACTIVE";
}

function toTaskRow(task: Task, missionId: string, groups: BattleGroup[]): TaskRow {
  const allocation = task.allocations[0];
  const crews = [
    ...new Set(
      groups
        .filter((group) => group.task_id === task.id && group.archived_at === null && group.lead_crew_id)
        .map((group) => group.lead_crew_id),
    ),
  ];
  return {
    id: task.id,
    mission_id: task.mission_id || allocation?.mission_id || missionId,
    detachment_id: task.organization_id,
    platoon_id: null,
    crew_id: crews.length === 1 ? crews[0] : null,
    asset_id: allocation?.asset_id ?? "",
    aiming_point: PRIMARY_AIMING_POINT,
    planned_quantity: task.allocations.reduce((sum, row) => sum + row.quantity, 0),
    status: "PUBLISHED",
    created_at: task.created_at,
  };
}

function toLaunchRow(launch: Launch): LaunchRow {
  return {
    id: launch.id,
    task_id: launch.task_id,
    launch_order: launch.launch_order,
    aiming_point: PRIMARY_AIMING_POINT,
    asset_id: launch.asset_id,
    asset_serial_number: launch.asset_serial_number.trim() || null,
    tracker_model_id: launch.tracker_model_id,
    tracker_model_serial_number: launch.tracker_model_serial_number?.trim() || null,
    trajectory_name: launch.trajectory_name,
    ammo_model_id: launch.ammo_model_id.trim() || null,
    ammo_quantity: launch.ammo_quantity,
    status: launchPlanStatus(launch.launch_status_id),
    reported_at: launch.reported_at,
    actual_launch_time: launch.actual_launch_time,
    cause_launch_problem_id: launch.cause_launch_problem_id.trim() || null,
    comments: launch.comments.trim() || null,
    created_at: launch.created_at,
    updated_at: launch.updated_at,
  };
}

function launchPlanStatus(launchStatusId: string): LaunchStatus {
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

function fail(message: string, action: "зберегти" | "завантажити"): PlanSyncResult {
  console.error(`Не вдалося ${action} план місії локально:`, message);
  return { ok: false, message };
}

export async function updateSingleLaunch(launchId: string, updates: Partial<Launch>) {
  const current = (await planningRepository.listLaunches()).find((item) => item.id === launchId);
  if (!current) {
    return fail("Пуск не знайдено в локальному сховищі.", "зберегти");
  }
  return planningRepository.saveLaunch({
    ...current,
    ...(updates.asset_id ? { asset_id: updates.asset_id } : {}),
    ...(updates.asset_serial_number !== undefined ? { asset_serial_number: updates.asset_serial_number.trim() || null } : {}),
    ...(updates.tracker_model_id !== undefined ? { tracker_model_id: updates.tracker_model_id } : {}),
    ...(updates.tracker_model_serial_number !== undefined
      ? { tracker_model_serial_number: updates.tracker_model_serial_number?.trim() || null }
      : {}),
    ...(updates.trajectory_name !== undefined ? { trajectory_name: updates.trajectory_name } : {}),
    ...(updates.ammo_model_id !== undefined ? { ammo_model_id: updates.ammo_model_id.trim() || null } : {}),
    ...(updates.ammo_quantity !== undefined ? { ammo_quantity: updates.ammo_quantity } : {}),
    ...(updates.launch_status_id !== undefined ? { status: launchPlanStatus(updates.launch_status_id) } : {}),
    ...(updates.reported_at !== undefined ? { reported_at: updates.reported_at } : {}),
    ...(updates.actual_launch_time !== undefined ? { actual_launch_time: updates.actual_launch_time } : {}),
    ...(updates.cause_launch_problem_id !== undefined
      ? { cause_launch_problem_id: updates.cause_launch_problem_id.trim() || null }
      : {}),
    ...(updates.comments !== undefined ? { comments: updates.comments.trim() || null } : {}),
    updated_at: new Date().toISOString(),
  });
}
