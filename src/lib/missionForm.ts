import { DICTIONARY } from "@/constants/dictionary";
import { isScheduledBeforeCreated, startOfDay } from "@/lib/dates";
import { parseRequiredNumber } from "@/lib/validation";
import type { TaskDraft } from "@/store/useTaskStore";
import type { Mission, Task } from "@/types/mission";

export interface DetachmentDraft {
  key: string;
  task_id?: string;
  organization_id: string;
  asset_id: string;
  quantity: string;
  aiming_point_id?: string;
}

export interface TargetDraft {
  key: string;
  target_id: string;
  aiming_point_ids: string[];
  detachments: DetachmentDraft[];
}

export function createFormKey(): string {
  return crypto.randomUUID();
}

export function emptyDetachment(): DetachmentDraft {
  return { key: createFormKey(), organization_id: "", asset_id: "", quantity: "", aiming_point_id: "" };
}

export function assignRowAimingPoint(block: TargetDraft, rowKey: string, aimingPointId: string): TargetDraft {
  const detachments = block.detachments.map((row) =>
    row.key === rowKey ? { ...row, aiming_point_id: aimingPointId } : row,
  );
  const selected = [
    ...new Set(detachments.map((row) => row.aiming_point_id).filter((id): id is string => Boolean(id))),
  ];
  return { ...block, detachments, aiming_point_ids: selected };
}

export function emptyTarget(): TargetDraft {
  return { key: createFormKey(), target_id: "", aiming_point_ids: [], detachments: [] };
}

export function linkedTasksForMission(mission: Mission, tasks: Task[]): Task[] {
  const related = tasks.filter(
    (task) => task.mission_id === mission.id || mission.task_ids.includes(task.id),
  );
  if (mission.archived_at !== null) {
    return related;
  }
  return related.filter((task) => task.archived_at === null);
}

export function draftsFromMission(mission: Mission, tasks: Task[]): TargetDraft[] {
  const related = linkedTasksForMission(mission, tasks);
  const byTarget = new Map<string, TargetDraft>();
  related.forEach((task) => {
    if (!task.organization_id && !task.asset_id) {
      return;
    }
    const targetId = task.target_ids[0] ?? "";
    const existing = byTarget.get(targetId) ?? {
      key: createFormKey(),
      target_id: targetId,
      aiming_point_ids: [],
      detachments: [],
    };
    existing.detachments.push({
      key: createFormKey(),
      task_id: task.id,
      organization_id: task.organization_id,
      asset_id: task.asset_id,
      quantity: task.quantity ? String(task.quantity) : "",
      aiming_point_id: task.aiming_point_id ?? "",
    });
    if (task.aiming_point_id) {
      existing.aiming_point_ids = [...new Set([...existing.aiming_point_ids, task.aiming_point_id])];
    }
    byTarget.set(targetId, existing);
  });
  return [...byTarget.values()];
}

export function toTaskDrafts(targets: TargetDraft[]): TaskDraft[] {
  const drafts: TaskDraft[] = [];
  targets.forEach((block) => {
    if (!block.target_id) {
      return;
    }
    block.detachments.forEach((row) => {
      const quantity = parseRequiredNumber(row.quantity);
      if (!row.organization_id || !row.asset_id || quantity === null || quantity <= 0) {
        return;
      }
      drafts.push({
        id: row.task_id,
        target_ids: [block.target_id],
        aiming_point_id: row.aiming_point_id || null,
        organization_id: row.organization_id,
        battle_groups_ids: [],
        asset_id: row.asset_id,
        quantity,
      });
    });
  });
  return drafts;
}

export function hasIncompleteAssignment(targets: TargetDraft[]): boolean {
  return targets.some((block) => {
    if (!block.target_id) {
      return true;
    }
    return block.detachments.some((row) => {
      const quantity = parseRequiredNumber(row.quantity);
      return !row.organization_id || !row.asset_id || quantity === null || quantity <= 0;
    });
  });
}

export function getScheduledIso(scheduledAt: Date | null): string {
  return scheduledAt ? startOfDay(scheduledAt).toISOString() : "";
}

export function getDateError(scheduledIso: string, createdAt: string): string | null {
  if (!scheduledIso) {
    return DICTIONARY.targets_catalog.validation.required;
  }
  if (isScheduledBeforeCreated(scheduledIso, createdAt)) {
    return DICTIONARY.missions.toasts.date_error;
  }
  return null;
}
