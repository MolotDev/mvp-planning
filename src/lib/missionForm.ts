import { DICTIONARY } from "@/constants/dictionary";
import { isScheduledBeforeCreated, startOfDay } from "@/lib/dates";
import { parseRequiredNumber } from "@/lib/validation";
import { taskBelongsToMission } from "@/lib/taskAllocations";
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
  const related = tasks.filter((task) => taskBelongsToMission(task, mission));
  if (mission.archived_at !== null) {
    return related;
  }
  return related.filter((task) => task.archived_at === null);
}

export function draftsFromMission(mission: Mission, tasks: Task[]): TargetDraft[] {
  const related = linkedTasksForMission(mission, tasks);
  const byTarget = new Map<string, TargetDraft>();
  related.forEach((task) => {
    task.allocations
      .filter((line) => line.mission_id === mission.id || (task.mission_id === mission.id && !line.mission_id))
      .forEach((line) => {
        if (!task.organization_id && !line.asset_id) {
          return;
        }
        const existing = byTarget.get(line.target_id) ?? {
          key: createFormKey(),
          target_id: line.target_id,
          aiming_point_ids: [],
          detachments: [],
        };
        existing.detachments.push({
          key: createFormKey(),
          task_id: line.id,
          organization_id: task.organization_id,
          asset_id: line.asset_id,
          quantity: line.quantity ? String(line.quantity) : "",
          aiming_point_id: line.aiming_point_id ?? "",
        });
        if (line.aiming_point_id) {
          existing.aiming_point_ids = [...new Set([...existing.aiming_point_ids, line.aiming_point_id])];
        }
        byTarget.set(line.target_id, existing);
      });
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
        target_id: block.target_id,
        aiming_point_id: row.aiming_point_id || null,
        organization_id: row.organization_id,
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
