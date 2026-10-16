import type { BattleGroup } from "@/types/battleGroup";
import type { Report } from "@/types/report";

type GroupSync = (group: BattleGroup) => void;
type GroupSource = () => BattleGroup[];

let syncGroup: GroupSync | null = null;
let readGroups: GroupSource = () => [];

export function registerLaunchSync(sync: GroupSync) {
  syncGroup = sync;
}

export function registerBattleGroupSource(source: GroupSource) {
  readGroups = source;
}

export function syncLaunchForGroup(group: BattleGroup) {
  syncGroup?.(group);
}

export function reconcileLaunchesWithBattleGroups() {
  if (!syncGroup) {
    return;
  }
  readGroups().forEach((group) => {
    syncGroup?.(group);
  });
}

type ReportTaskSync = (taskId: string) => void;
type ReportReconcile = () => void;

let syncReport: ReportTaskSync | null = null;
let reconcileReports: ReportReconcile | null = null;

export function registerReportSync(sync: ReportTaskSync) {
  syncReport = sync;
}

export function registerReportReconcile(reconcile: ReportReconcile) {
  reconcileReports = reconcile;
}

export function syncReportForTask(taskId: string) {
  syncReport?.(taskId);
}

export function syncAllocatedReports() {
  reconcileReports?.();
}

let readReports: () => Report[] = () => [];

export function registerReportSource(source: () => Report[]) {
  readReports = source;
}

export function readAllocatedReports(): Report[] {
  return readReports();
}

let readMissionSchedule: (missionId: string) => string | null = () => null;

export function registerMissionSchedule(source: (missionId: string) => string | null) {
  readMissionSchedule = source;
}

export function missionScheduledAt(missionId: string): string | null {
  return missionId ? readMissionSchedule(missionId) : null;
}
