import { CREWS } from "@/data/crews";
import { assetName } from "@/lib/assets";
import { DICTIONARY } from "@/constants/dictionary";
import { formatIsoDate, startOfDay } from "@/lib/dates";
import {
  assessBattleGroup,
  crewTotal,
  TASK_UAV_CAPACITY,
  type BattleGroupAssessment,
} from "@/lib/battleGroupCapacity";
import type { BattleGroup, BattleGroupInput } from "@/types/battleGroup";
import type { UavAsset } from "@/types/mission";

export function taskAllocation(task: { allocations?: { asset_id: string; quantity: number }[] }): UavAsset[] {
  const totals = new Map<string, number>();
  (task.allocations ?? []).forEach((line) => {
    if (!line.asset_id || line.quantity <= 0) {
      return;
    }
    totals.set(line.asset_id, (totals.get(line.asset_id) ?? 0) + line.quantity);
  });
  return [...totals.entries()].map(([asset_id, quantity]) => ({ asset_id, quantity }));
}

export { TASK_UAV_CAPACITY };

export function evenDistribution(
  totalQuantity: number,
  crewIds: string[],
): { crewId: string; quantity: number }[] {
  if (!Number.isInteger(totalQuantity) || totalQuantity <= 0 || crewIds.length === 0) {
    return [];
  }
  const baseQty = Math.floor(totalQuantity / crewIds.length);
  const remainder = totalQuantity % crewIds.length;
  return crewIds.flatMap((crewId, index) => {
    const quantity = baseQty + (index < remainder ? 1 : 0);
    return quantity > 0 ? [{ crewId, quantity }] : [];
  });
}

export function crewCount(leadCrewId: string, supportCrewIds: string[]): number {
  return crewTotal(leadCrewId, supportCrewIds);
}

export interface BattleGroupRules {
  exceptGroupId?: string;
  taskAssets?: UavAsset[];
  launchRatePerHour?: number;
  shiftDurationHours?: number;
  sameDayTaskIds?: ReadonlySet<string>;
}

export function operationalDay(iso: string | null | undefined): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return formatIsoDate(startOfDay(date));
}

export function taskIdsOnOperationalDay(
  taskId: string,
  tasks: { id: string; scheduled_at: string }[],
  _missions: { id: string; scheduled_at: string }[],
): Set<string> {
  const task = tasks.find((item) => item.id === taskId);
  const day = operationalDay(task?.scheduled_at);
  if (!day) {
    return new Set([taskId]);
  }
  const ids = tasks.filter((item) => operationalDay(item.scheduled_at) === day).map((item) => item.id);
  return new Set(ids.length > 0 ? ids : [taskId]);
}

export interface BattleGroupInspection extends BattleGroupAssessment {
  crewError: string | null;
  blocking: string | null;
}

export function occupiedCrewIds(
  groups: BattleGroup[],
  exceptGroupId?: string,
  sameDayTaskIds?: ReadonlySet<string>,
): Set<string> {
  const occupied = new Set<string>();
  groups.forEach((group) => {
    if (group.archived_at !== null) {
      return;
    }
    if (exceptGroupId && group.id === exceptGroupId) {
      return;
    }
    if (sameDayTaskIds && !sameDayTaskIds.has(group.task_id)) {
      return;
    }
    occupied.add(group.lead_crew_id);
    group.support_crew_ids.forEach((id) => occupied.add(id));
  });
  return occupied;
}

export function taskAllocatedQuantity(groups: BattleGroup[], taskId: string, exceptGroupId?: string): number {
  return groups
    .filter(
      (group) =>
        group.task_id === taskId &&
        group.archived_at === null &&
        group.id !== exceptGroupId,
    )
    .reduce((sum, group) => sum + group.uav_quantity, 0);
}

export function crewName(id: string): string {
  return CREWS.find((crew) => crew.id === id)?.name ?? id;
}

export function uavName(id: string): string {
  return assetName(id);
}

export function formatBattleGroupSummary(group: BattleGroup): string {
  const lead = crewName(group.lead_crew_id);
  const support = group.support_crew_ids.map(crewName);
  const supportLabel = support.length > 0 ? ` (${support.join(", ")})` : "";
  return `${lead}${supportLabel} - ${group.uav_quantity} * ${uavName(group.asset_id)}`;
}

export function formatTaskAssets(assets: UavAsset[]): string {
  return assets
    .filter((asset) => asset.asset_id && asset.quantity > 0)
    .map((asset) => `${uavName(asset.asset_id)} x ${asset.quantity}`)
    .join(", ");
}

export function visibleBattleGroups(
  task: { archived_at: string | null },
  groups: BattleGroup[],
): BattleGroup[] {
  if (task.archived_at !== null) {
    return groups;
  }
  return groups.filter((group) => group.archived_at === null);
}

export function inspectBattleGroup(
  input: BattleGroupInput,
  groups: BattleGroup[],
  rules: BattleGroupRules = {},
): BattleGroupInspection {
  const assessment = assessBattleGroup(input, groups, rules);
  let crewError: string | null = null;
  if (input.lead_crew_id && input.support_crew_ids.includes(input.lead_crew_id)) {
    crewError = DICTIONARY.tasks.validation.lead_in_support;
  } else if (input.lead_crew_id) {
    const occupied = occupiedCrewIds(groups, rules.exceptGroupId, rules.sameDayTaskIds);
    const assigned = [input.lead_crew_id, ...input.support_crew_ids];
    if (assigned.some((id) => occupied.has(id)) || new Set(assigned).size !== assigned.length) {
      crewError = DICTIONARY.tasks.validation.crew_busy;
    }
  }
  const missing =
    !input.lead_crew_id || !input.asset_id || input.uav_quantity <= 0
      ? DICTIONARY.targets_catalog.validation.required
      : null;
  return {
    ...assessment,
    crewError,
    blocking: missing ?? crewError ?? assessment.assetError ?? assessment.capacityError,
  };
}

export function validateBattleGroupInput(
  input: BattleGroupInput,
  groups: BattleGroup[],
  rules: BattleGroupRules = {},
): string | null {
  return inspectBattleGroup(input, groups, rules).blocking;
}
