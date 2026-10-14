import { DICTIONARY } from "@/constants/dictionary";
import type { BattleGroup, BattleGroupInput } from "@/types/battleGroup";
import type { UavAsset } from "@/types/mission";

export const LAUNCH_RATE_PER_HOUR = 1;
export const SHIFT_DURATION_HOURS = 10;
export const TASK_UAV_CAPACITY = 200;

export interface CapacityOptions {
  launchRatePerHour?: number;
  shiftDurationHours?: number;
}

export function resolveShiftDurationHours(): number {
  return SHIFT_DURATION_HOURS;
}

export function resolveLaunchRatePerHour(): number {
  return LAUNCH_RATE_PER_HOUR;
}

export function crewTotal(leadCrewId: string, supportCrewIds: string[]): number {
  return new Set([leadCrewId, ...supportCrewIds].filter(Boolean)).size;
}

export function maxBattleGroupQuantity(
  crews: number,
  options: CapacityOptions = {},
): number {
  const rate = options.launchRatePerHour ?? LAUNCH_RATE_PER_HOUR;
  const shift = options.shiftDurationHours ?? SHIFT_DURATION_HOURS;
  return crews * rate * shift;
}

export function executionHours(
  quantity: number,
  crews: number,
  launchRatePerHour = LAUNCH_RATE_PER_HOUR,
): number {
  if (crews <= 0 || launchRatePerHour <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return quantity / (crews * launchRatePerHour);
}

export function exceedsShift(executionTime: number, shiftDurationHours: number): boolean {
  return executionTime > shiftDurationHours;
}

export function formatHours(value: number): string {
  return value.toFixed(1);
}

export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export function crewWord(count: number): string {
  const absolute = Math.abs(count) % 100;
  const last = absolute % 10;
  if (absolute > 10 && absolute < 20) {
    return DICTIONARY.tasks.battle_groups.crew_many;
  }
  if (last === 1) {
    return DICTIONARY.tasks.battle_groups.crew_one;
  }
  if (last >= 2 && last <= 4) {
    return DICTIONARY.tasks.battle_groups.crew_few;
  }
  return DICTIONARY.tasks.battle_groups.crew_many;
}

export function executionEstimateLabel(hours: number): string {
  return fillTemplate(DICTIONARY.tasks.battle_groups.estimated_time, {
    hours: formatHours(hours),
  });
}

export function executionBreakdown(quantity: number, crews: number, hours: number): string {
  return fillTemplate(DICTIONARY.tasks.battle_groups.estimate_breakdown, {
    quantity,
    crews,
    crew_word: crewWord(crews),
    hours: formatHours(hours),
  });
}

export function timeExceededMessage(hours: number, shiftHours: number): string {
  return fillTemplate(DICTIONARY.tasks.battle_groups.time_exceeded_error, {
    hours: formatHours(hours),
    shift: formatHours(shiftHours),
  });
}

export function assetLimitMessage(currentSum: number, taskLimit: number): string {
  return fillTemplate(DICTIONARY.tasks.errors.exceeds_task_limit, {
    current_sum: currentSum,
    task_limit: taskLimit,
  });
}

export function taskAssetLimit(assets: UavAsset[], uavModelId: string): number {
  return assets
    .filter((asset) => asset.asset_id === uavModelId)
    .reduce((sum, asset) => sum + asset.quantity, 0);
}

export function modelAllocatedQuantity(
  groups: BattleGroup[],
  taskId: string,
  uavModelId: string,
  exceptGroupId?: string,
): number {
  return groups
    .filter(
      (group) =>
        group.task_id === taskId &&
        group.archived_at === null &&
        group.asset_id === uavModelId &&
        group.id !== exceptGroupId,
    )
    .reduce((sum, group) => sum + group.uav_quantity, 0);
}

export interface AssetLimitBreach {
  uavModelId: string;
  currentSum: number;
  taskLimit: number;
}

export function assetLimitBreaches(groups: BattleGroup[], assets: UavAsset[]): AssetLimitBreach[] {
  const modelIds = new Set([
    ...assets.map((asset) => asset.asset_id),
    ...groups.map((group) => group.asset_id),
  ]);
  const breaches: AssetLimitBreach[] = [];
  modelIds.forEach((uavModelId) => {
    const currentSum = groups
      .filter((group) => group.archived_at === null && group.asset_id === uavModelId)
      .reduce((sum, group) => sum + group.uav_quantity, 0);
    const taskLimit = taskAssetLimit(assets, uavModelId);
    if (currentSum > taskLimit) {
      breaches.push({ uavModelId, currentSum, taskLimit });
    }
  });
  return breaches;
}

export interface BattleGroupAssessment {
  timeError: string | null;
  assetError: string | null;
  capacityError: string | null;
  executionTime: number | null;
  shiftHours: number;
  crews: number;
}

export function remainingTaskAssets(assets: UavAsset[], groups: BattleGroup[]): number {
  const limit = assets.reduce((sum, asset) => sum + asset.quantity, 0);
  const used = groups
    .filter((group) => group.archived_at === null)
    .reduce((sum, group) => sum + group.uav_quantity, 0);
  return Math.max(0, limit - used);
}

export function remainingModelQuantity(
  assets: UavAsset[],
  groups: BattleGroup[],
  taskId: string,
  uavModelId: string,
  exceptGroupId?: string,
): number {
  return Math.max(
    0,
    taskAssetLimit(assets, uavModelId) -
      modelAllocatedQuantity(groups, taskId, uavModelId, exceptGroupId),
  );
}

export function assessBattleGroup(
  input: BattleGroupInput,
  groups: BattleGroup[],
  options: CapacityOptions & { exceptGroupId?: string; taskAssets?: UavAsset[] } = {},
): BattleGroupAssessment {
  const shiftHours = options.shiftDurationHours ?? resolveShiftDurationHours();
  const crews = crewTotal(input.lead_crew_id, input.support_crew_ids);
  const assets = options.taskAssets ?? [];
  let assetError: string | null = null;
  if (input.asset_id && input.uav_quantity > 0) {
    const currentSum =
      modelAllocatedQuantity(groups, input.task_id, input.asset_id, options.exceptGroupId) +
      input.uav_quantity;
    const taskLimit = taskAssetLimit(assets, input.asset_id);
    if (currentSum > taskLimit) {
      assetError = assetLimitMessage(currentSum, taskLimit);
    }
  }

  const nextTotal =
    groups
      .filter(
        (group) =>
          group.task_id === input.task_id &&
          group.archived_at === null &&
          group.id !== options.exceptGroupId,
      )
      .reduce((sum, group) => sum + group.uav_quantity, 0) + input.uav_quantity;
  const capacityError = nextTotal > TASK_UAV_CAPACITY ? DICTIONARY.tasks.validation.task_capacity : null;

  return { timeError: null, assetError, capacityError, executionTime: null, shiftHours, crews };
}
