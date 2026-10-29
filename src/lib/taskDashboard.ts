import { startOfDay } from "@/lib/dates";
import type { BattleGroup } from "@/types/battleGroup";
import type { CrewAssignmentDraft } from "@/lib/crewAllocation";
import type { Launch } from "@/types/launch";
import type { Task } from "@/types/mission";

export function draftsFromGroups(task: Task, groups: BattleGroup[]): CrewAssignmentDraft[] {
  const keepHistorical = task.archived_at !== null || Boolean(task.cancellation);
  const active = groups.filter(
    (group) => group.task_id === task.id && (keepHistorical || group.archived_at === null),
  );
  const rows: CrewAssignmentDraft[] = [];
  active.forEach((group) => {
    const allocationId =
      group.allocation_line_id && task.allocations.some((line) => line.id === group.allocation_line_id)
        ? group.allocation_line_id
        : task.allocations.find((line) => line.asset_id === group.asset_id)?.id ?? "";
    if (!allocationId) {
      return;
    }
    const existing = rows.find((row) => row.allocationId === allocationId && row.crewId === group.lead_crew_id);
    if (existing) {
      existing.quantity += group.uav_quantity;
      return;
    }
    rows.push({
      allocationId,
      crewId: group.lead_crew_id,
      quantity: group.uav_quantity,
    });
  });
  return rows;
}

export function parseAllocationQuantity(raw: string, max: number): number | null {
  if (!/^[1-9][0-9]*$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  if (value > max) {
    return null;
  }
  return value;
}

export function crewClearanceAssetIds(crewId: string, groups: BattleGroup[]): string[] {
  const ids = new Set<string>();
  groups.forEach((group) => {
    if (group.archived_at === null && group.lead_crew_id === crewId && group.asset_id) {
      ids.add(group.asset_id);
    }
  });
  return [...ids];
}

export type CrewDayKind = "past" | "today" | "future";

export interface CrewDayLoad {
  key: string;
  label: string;
  count: number;
  kind: CrewDayKind;
}

export interface CrewEngagement {
  hits: number;
  total: number;
  rate: number;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayLabel(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}`;
}

export function assetShortName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length <= 3 ? trimmed : trimmed.slice(0, 3);
}

export interface HeatmapAssetCell {
  assetId: string;
  total: number;
  successful: number;
  problematic: number;
}

export interface HeatmapDay {
  key: string;
  label: string;
  today: boolean;
  assets: HeatmapAssetCell[];
}

export interface CrewHeatmapRow {
  crewId: string;
  days: HeatmapDay[];
  successRate: number | null;
}

export function crewHeatmap(
  crewIds: string[],
  tasks: Task[],
  groups: BattleGroup[],
  launches: Launch[],
  now: Date,
): CrewHeatmapRow[] {
  const today = startOfDay(now);
  const days = Array.from({ length: 7 }, (_, index) => addDays(today, index - 3));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  return crewIds.map((crewId) => {
    const groupIds = new Set(
      groups.filter((group) => group.archived_at === null && group.lead_crew_id === crewId).map((group) => group.id),
    );
    const crewLaunches = launches.filter(
      (launch) => launch.archived_at === null && groupIds.has(launch.battle_group_id),
    );
    const historic = crewLaunches.filter((launch) => taskById.has(launch.task_id));
    const successes = historic.filter((launch) => launch.launch_status_id === "success").length;
    const buckets = new Map<string, Map<string, HeatmapAssetCell>>();
    historic.forEach((launch) => {
      const task = taskById.get(launch.task_id);
      if (!task?.scheduled_at) {
        return;
      }
      const key = dayKey(startOfDay(new Date(task.scheduled_at)));
      const byAsset = buckets.get(key) ?? new Map<string, HeatmapAssetCell>();
      const current = byAsset.get(launch.asset_id) ?? {
        assetId: launch.asset_id,
        total: 0,
        successful: 0,
        problematic: 0,
      };
      current.total += 1;
      if (launch.launch_status_id === "success") {
        current.successful += 1;
      }
      if (launch.launch_status_id === "problem") {
        current.problematic += 1;
      }
      byAsset.set(launch.asset_id, current);
      buckets.set(key, byAsset);
    });
    return {
      crewId,
      successRate: historic.length === 0 ? null : Math.round((successes / historic.length) * 100),
      days: days.map((date) => ({
        key: dayKey(date),
        label: dayLabel(date),
        today: date.getTime() === today.getTime(),
        assets: [...(buckets.get(dayKey(date))?.values() ?? [])],
      })),
    };
  });
}

export function crewTimelineWindow(now: Date, scheduledAt?: string): Date[] {
  const today = startOfDay(now);
  const scheduled = scheduledAt ? startOfDay(new Date(scheduledAt)) : today;
  const end = scheduled.getTime() > today.getTime() ? scheduled : today;
  return Array.from({ length: 7 }, (_, index) => addDays(end, index - 6));
}

export function crewWeekLoads(
  crewId: string,
  tasks: Task[],
  groups: BattleGroup[],
  launches: Launch[],
  now: Date,
  scheduledAt?: string,
): { days: CrewDayLoad[]; engagement: CrewEngagement } {
  const today = startOfDay(now).getTime();
  const days = crewTimelineWindow(now, scheduledAt);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const groupIds = new Set(
    groups.filter((group) => group.archived_at === null && group.lead_crew_id === crewId).map((group) => group.id),
  );
  const counts = new Map<string, number>();
  let hits = 0;
  let total = 0;
  const windowStart = days[0]?.getTime() ?? today;
  const windowEnd = days[days.length - 1]?.getTime() ?? today;
  launches.forEach((launch) => {
    if (launch.archived_at !== null || !groupIds.has(launch.battle_group_id)) {
      return;
    }
    const task = taskById.get(launch.task_id);
    if (!task?.scheduled_at) {
      return;
    }
    const day = startOfDay(new Date(task.scheduled_at)).getTime();
    if (day < windowStart || day > windowEnd) {
      return;
    }
    const key = dayKey(new Date(day));
    counts.set(key, (counts.get(key) ?? 0) + 1);
    total += 1;
    if (launch.launch_status_id === "success") {
      hits += 1;
    }
  });
  return {
    days: days.map((date) => {
      const time = date.getTime();
      const kind: CrewDayKind = time < today ? "past" : time > today ? "future" : "today";
      return {
        key: dayKey(date),
        label: dayLabel(date),
        count: counts.get(dayKey(date)) ?? 0,
        kind,
      };
    }),
    engagement: {
      hits,
      total,
      rate: total === 0 ? 0 : Math.round((hits / total) * 100),
    },
  };
}
