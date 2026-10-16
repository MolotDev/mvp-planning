import { createLaunchRecord } from "@/data/launchSeed";
import { applyDefaultAimingMgrs } from "@/lib/launchAiming";
import { LAUNCH_STATUSES, PLANNED_LAUNCH_STATUS_ID, TRACKERS, AMMOS } from "@/data/launchCatalog";
import { DICTIONARY } from "@/constants/dictionary";
import { crewName, uavName } from "@/lib/battleGroup";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch, LaunchReportInput } from "@/types/launch";
import type { Task } from "@/types/mission";
import type { Target } from "@/types/target";

export interface LaunchMetrics {
  planned: number;
  executed: number;
  problematic: number;
  canceled: number;
}

export function activeLaunches(launches: Launch[]): Launch[] {
  return launches.filter((launch) => launch.archived_at === null);
}

export function getLaunchMetrics(launches: Launch[]): LaunchMetrics {
  const visible = activeLaunches(launches);
  return {
    planned: visible.filter((launch) => launch.launch_status_id === PLANNED_LAUNCH_STATUS_ID).length,
    executed: visible.filter((launch) => launch.launch_status_id === "success").length,
    problematic: visible.filter((launch) => launch.launch_status_id === "problem").length,
    canceled: visible.filter((launch) => launch.launch_status_id === "abort").length,
  };
}

export function launchStatusName(statusId: string): string {
  if (statusId === PLANNED_LAUNCH_STATUS_ID) {
    return DICTIONARY.launches.status_planned;
  }
  return LAUNCH_STATUSES.find((status) => status.id === statusId)?.name ?? statusId;
}

export function trackerName(id: string | null | undefined): string {
  if (!id) {
    return "";
  }
  return TRACKERS.find((tracker) => tracker.id === id)?.name ?? "";
}

export interface LaunchLifecycle {
  reported_at: string | null;
  archived_at: string | null;
}

export function isLaunchReadOnly(
  launch: LaunchLifecycle,
  task?: LaunchLifecycle | null,
  mission?: LaunchLifecycle | null,
): boolean {
  if (launch.reported_at !== null || launch.archived_at !== null) {
    return true;
  }
  if (task != null && (task.reported_at !== null || task.archived_at !== null)) {
    return true;
  }
  return mission != null && (mission.reported_at !== null || mission.archived_at !== null);
}

export function launchLockKind(
  launch: LaunchLifecycle,
  task?: LaunchLifecycle | null,
  mission?: LaunchLifecycle | null,
): "archived" | "reported" | null {
  if (!isLaunchReadOnly(launch, task, mission)) {
    return null;
  }
  if (
    launch.archived_at !== null ||
    (task != null && task.archived_at !== null) ||
    (mission != null && mission.archived_at !== null)
  ) {
    return "archived";
  }
  return "reported";
}

export function ammoName(id: string): string {
  return AMMOS.find((ammo) => ammo.id === id)?.name ?? "";
}

export function resolveLaunchMgrs(launch: Launch, tasks: Task[], targets: Target[]): string {
  const aiming = launch.aiming_point_mgrs.trim();
  if (aiming) {
    return aiming;
  }
  const task = tasks.find((item) => item.id === launch.task_id);
  const line = task?.allocations.find((item) => item.id === launch.allocation_line_id) ?? task?.allocations[0];
  const target = targets.find((item) => item.id === line?.target_id);
  return target?.mgrs ?? "";
}

export function battleGroupCrewLabel(group: BattleGroup | undefined): string {
  if (!group) {
    return "";
  }
  const support = group.support_crew_ids.map(crewName);
  const supportLabel = support.length > 0 ? ` (${support.join(", ")})` : "";
  return `${crewName(group.lead_crew_id)}${supportLabel}`;
}

export function formatUavCell(launch: Launch): string {
  const name = uavName(launch.asset_id);
  return launch.asset_serial_number
    ? `${name} / ${launch.asset_serial_number}`
    : name;
}

export function formatTrackerCell(launch: Launch): string {
  const name = trackerName(launch.tracker_model_id);
  const serial = launch.tracker_model_serial_number ?? "";
  if (!name && !serial) {
    return "";
  }
  return [name, serial].filter(Boolean).join(" / ");
}

export function formatAmmoCell(launch: Launch): string {
  const name = ammoName(launch.ammo_model_id);
  if (!name && launch.ammo_quantity <= 0) {
    return "";
  }
  return name ? `${name} x ${launch.ammo_quantity}` : String(launch.ammo_quantity);
}

export function isPlannedUnprocessed(launch: Launch): boolean {
  return (
    launch.archived_at === null &&
    launch.reported_at === null &&
    launch.launch_status_id === PLANNED_LAUNCH_STATUS_ID &&
    !isLaunchProcessed(launch)
  );
}

export function quantityDiscrepancy(
  planned: number,
  launches: Launch[],
  battleGroupId: string,
): { planned: number; actual: number } | null {
  const active = launches.filter(
    (launch) => launch.battle_group_id === battleGroupId && launch.archived_at === null,
  );
  const processed = active.filter((launch) => !isPlannedUnprocessed(launch)).length;
  if (processed <= planned) {
    return null;
  }
  return { planned, actual: active.length };
}

export function isLaunchProcessed(launch: {
  aiming_point_mgrs: string | null;
  trajectory_name?: string | null;
  asset_serial_number: string | null;
  ammo_model_id: string | null;
  ammo_quantity: number | null;
}): boolean {
  return (
    launch.aiming_point_mgrs !== null &&
    launch.aiming_point_mgrs !== "" &&
    launch.trajectory_name !== null &&
    launch.trajectory_name !== undefined &&
    launch.trajectory_name.trim() !== "" &&
    launch.asset_serial_number !== null &&
    launch.asset_serial_number.trim() !== "" &&
    launch.ammo_model_id !== null &&
    launch.ammo_model_id !== "" &&
    launch.ammo_quantity !== null &&
    launch.ammo_quantity > 0
  );
}

export interface ProcessedDraftFields {
  aiming_point_mgrs: string;
  trajectory_name: string;
  asset_serial_number: string;
  ammo_model_id: string;
  ammo_quantity: string;
}

export function processedDraftValues(draft: ProcessedDraftFields, emptyQuantity: number) {
  const quantity = draft.ammo_quantity.trim() === "" ? emptyQuantity : Number(draft.ammo_quantity);
  if (!Number.isFinite(quantity)) {
    return null;
  }
  return {
    aiming_point_mgrs: draft.aiming_point_mgrs.trim(),
    trajectory_name: draft.trajectory_name.trim() || null,
    asset_serial_number: draft.asset_serial_number,
    ammo_model_id: draft.ammo_model_id,
    ammo_quantity: quantity,
  };
}

export function processedTransitionPatch(launch: Launch, draft: ProcessedDraftFields, emptyQuantity: number) {
  const next = processedDraftValues(draft, emptyQuantity);
  if (!next) {
    return null;
  }
  const wasProcessed = isLaunchProcessed(launch);
  const nowProcessed = isLaunchProcessed(next);
  if (!wasProcessed && !nowProcessed) {
    return null;
  }
  if (
    wasProcessed === nowProcessed &&
    launch.aiming_point_mgrs === next.aiming_point_mgrs &&
    (launch.trajectory_name ?? null) === next.trajectory_name &&
    launch.asset_serial_number === next.asset_serial_number &&
    launch.ammo_model_id === next.ammo_model_id &&
    launch.ammo_quantity === next.ammo_quantity
  ) {
    return null;
  }
  return next;
}

export function withProcessedAt(launch: Launch, now: string): Launch {
  const processedAt = isLaunchProcessed(launch) ? (launch.processed_at ?? now) : null;
  if (launch.processed_at === processedAt) {
    return launch;
  }
  return { ...launch, processed_at: processedAt };
}

export function countProcessedLaunches(launches: Launch[]): { processed: number; total: number } {
  const visible = launches.filter((launch) => launch.archived_at === null);
  return {
    processed: visible.filter(isLaunchProcessed).length,
    total: visible.length,
  };
}

export function filterLaunches(
  launches: Launch[],
  tasks: Task[],
  targets: Target[],
  query: string,
  statusId: string,
): Launch[] {
  const q = query.trim().toLowerCase();
  return activeLaunches(launches)
    .filter((launch) => !statusId || launch.launch_status_id === statusId)
    .filter((launch) => {
      if (!q) {
        return true;
      }
      const mgrs = resolveLaunchMgrs(launch, tasks, targets).toLowerCase();
      return (
        launch.asset_serial_number.toLowerCase().includes(q) ||
        (launch.tracker_model_serial_number ?? "").toLowerCase().includes(q) ||
        launch.aiming_point_mgrs.toLowerCase().includes(q) ||
        mgrs.includes(q)
      );
    })
    .sort((left, right) => {
      const byDate = right.created_at.localeCompare(left.created_at);
      return byDate !== 0 ? byDate : right.id.localeCompare(left.id);
    });
}

export function syncLaunchesWithGroup(
  launches: Launch[],
  group: BattleGroup,
  options: { now?: string; defaultMgrs?: string | null; allocationLineId?: string | null } = {},
): Launch[] {
  const now = options.now ?? new Date().toISOString();
  const defaultMgrs = options.defaultMgrs ?? null;
  const allocationLineId = options.allocationLineId ?? null;
  let next = launches.map((launch) => ({ ...launch }));
  if (group.archived_at !== null) {
    return next.map((launch) =>
      launch.battle_group_id === group.id && launch.archived_at === null && launch.reported_at === null
        ? { ...launch, archived_at: group.archived_at, updated_at: now }
        : launch,
    );
  }

  next = next.map((launch) =>
    launch.battle_group_id === group.id &&
    launch.archived_at === null &&
    launch.reported_at === null &&
    (launch.asset_id !== group.asset_id || launch.task_id !== group.task_id)
      ? { ...launch, asset_id: group.asset_id, task_id: group.task_id, updated_at: now }
      : launch,
  );

  const active = next.filter((launch) => launch.battle_group_id === group.id && launch.archived_at === null);
  if (active.length < group.uav_quantity) {
    const missing = group.uav_quantity - active.length;
    const created = Array.from({ length: missing }, (_, index) => {
      const createdAt = new Date(Date.now() + index).toISOString();
      return createLaunchRecord(group, createdAt, crypto.randomUUID(), defaultMgrs ?? "", allocationLineId);
    });
    return applyDefaultAimingMgrs([...created.reverse(), ...next], group.id, defaultMgrs);
  }

  if (active.length > group.uav_quantity) {
    const excess = active.length - group.uav_quantity;
    const victims = active
      .filter((launch) => isPlannedUnprocessed(launch))
      .sort((left, right) => right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id))
      .slice(0, excess)
      .map((launch) => launch.id);
    const drop = new Set(victims);
    next = next.map((launch) =>
      drop.has(launch.id) ? { ...launch, archived_at: now, updated_at: now } : launch,
    );
  }
  return applyDefaultAimingMgrs(next, group.id, defaultMgrs);
}

export function isLaunchReportStatus(statusId: string): boolean {
  return LAUNCH_STATUSES.some((status) => status.id === statusId);
}

export function emptyLaunchReport(): LaunchReportInput {
  return {
    asset_serial_number: "",
    tracker_model_id: "",
    tracker_model_serial_number: "",
    aiming_point_mgrs: "",
    ammo_model_id: "",
    ammo_quantity: 0,
    launch_status_id: "",
    cause_launch_problem_id: "",
    comments: "",
  };
}
