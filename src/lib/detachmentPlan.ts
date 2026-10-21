import { DICTIONARY } from "@/constants/dictionary";
import { detachmentName } from "@/lib/detachments";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import type { CrewAssignmentDraft } from "@/lib/crewAllocation";
import { parseRequiredNumber } from "@/lib/validation";
import type { BattleGroup, Crew } from "@/types/battleGroup";
import type { Task, TaskAllocation } from "@/types/mission";

export interface PlanForceRow {
  key: string;
  allocationId: string;
  crewId: string;
  assetId: string;
  quantity: string;
  aimingPointId: string;
}

export interface PlanTargetBlock {
  key: string;
  targetId: string;
  rows: PlanForceRow[];
}

export interface SharedAimingUse {
  detachmentId: string;
  detachmentName: string;
  droneCount: number;
  droneModel: string;
}

export function emptyForceRow(): PlanForceRow {
  return {
    key: crypto.randomUUID(),
    allocationId: crypto.randomUUID(),
    crewId: "",
    assetId: "",
    quantity: "",
    aimingPointId: "",
  };
}

export function emptyPlanTarget(): PlanTargetBlock {
  return { key: crypto.randomUUID(), targetId: "", rows: [] };
}

function splitAllocation(block: PlanTargetBlock, row: PlanForceRow): string {
  const shared = block.rows.some((other) => other.key !== row.key && other.allocationId === row.allocationId);
  return shared ? crypto.randomUUID() : row.allocationId;
}

export function assignPlanAimingPoint(block: PlanTargetBlock, rowKey: string, aimingPointId: string): PlanTargetBlock {
  return {
    ...block,
    rows: block.rows.map((row) => {
      if (row.key !== rowKey || row.aimingPointId === aimingPointId) {
        return row;
      }
      return { ...row, aimingPointId, allocationId: splitAllocation(block, row) };
    }),
  };
}

export function assignCrewAsset(blocks: PlanTargetBlock[], crewId: string, assetId: string): PlanTargetBlock[] {
  if (!crewId) {
    return blocks;
  }
  return blocks.map((block) => ({
    ...block,
    rows: block.rows.map((row) => {
      if (row.crewId !== crewId || row.assetId === assetId) {
        return row;
      }
      return { ...row, assetId, allocationId: splitAllocation(block, row) };
    }),
  }));
}

export function assignPlanAsset(block: PlanTargetBlock, rowKey: string, assetId: string): PlanTargetBlock {
  return {
    ...block,
    rows: block.rows.map((row) => {
      if (row.key !== rowKey || row.assetId === assetId) {
        return row;
      }
      return { ...row, assetId, allocationId: splitAllocation(block, row) };
    }),
  };
}

export function planBlocksFromTask(task: Task, groups: BattleGroup[]): PlanTargetBlock[] {
  const blocks: PlanTargetBlock[] = [];
  task.allocations.forEach((line) => {
    let block = blocks.find((item) => item.targetId === line.target_id);
    if (!block) {
      block = { key: line.target_id || crypto.randomUUID(), targetId: line.target_id, rows: [] };
      blocks.push(block);
    }
    const crews = groups.filter(
      (group) => group.archived_at === null && group.task_id === task.id && group.allocation_line_id === line.id,
    );
    const assigned = crews.reduce((sum, group) => sum + group.uav_quantity, 0);
    crews.forEach((group) => {
      block?.rows.push({
        key: group.id,
        allocationId: line.id,
        crewId: group.lead_crew_id,
        assetId: line.asset_id,
        quantity: group.uav_quantity ? String(group.uav_quantity) : "",
        aimingPointId: line.aiming_point_id ?? "",
      });
    });
    const leftover = line.quantity - assigned;
    if (crews.length === 0 || leftover > 0) {
      block.rows.push({
        key: crews.length === 0 ? line.id : `${line.id}:open`,
        allocationId: line.id,
        crewId: "",
        assetId: line.asset_id,
        quantity: String(crews.length === 0 ? line.quantity : leftover),
        aimingPointId: line.aiming_point_id ?? "",
      });
    }
  });
  return blocks;
}

interface GroupedLine {
  allocationId: string;
  targetId: string;
  aimingPointId: string | null;
  assetId: string;
  quantity: number;
}

function groupedLines(blocks: PlanTargetBlock[]): GroupedLine[] {
  const groups = new Map<string, GroupedLine>();
  blocks.forEach((block) => {
    if (!block.targetId) {
      return;
    }
    block.rows.forEach((row) => {
      const quantity = parseRequiredNumber(row.quantity);
      if (!row.assetId || quantity === null || quantity <= 0) {
        return;
      }
      const aimingPointId = row.aimingPointId || null;
      const key = `${block.targetId}\0${aimingPointId ?? ""}\0${row.assetId}`;
      const existing = groups.get(key);
      if (existing) {
        existing.quantity += quantity;
        return;
      }
      groups.set(key, {
        allocationId: row.allocationId,
        targetId: block.targetId,
        aimingPointId,
        assetId: row.assetId,
        quantity,
      });
    });
  });
  return [...groups.values()];
}

export function allocationsFromBlocks(blocks: PlanTargetBlock[], missionId: string): TaskAllocation[] {
  return groupedLines(blocks).map((line) => ({
    id: line.allocationId,
    mission_id: missionId,
    target_id: line.targetId,
    aiming_point_id: line.aimingPointId,
    asset_id: line.assetId,
    quantity: line.quantity,
  }));
}

export function crewDraftsFromBlocks(blocks: PlanTargetBlock[]): CrewAssignmentDraft[] {
  const lines = groupedLines(blocks);
  const drafts: CrewAssignmentDraft[] = [];
  blocks.forEach((block) => {
    block.rows.forEach((row) => {
      const quantity = parseRequiredNumber(row.quantity);
      if (!block.targetId || !row.crewId || !row.assetId || quantity === null || quantity <= 0) {
        return;
      }
      const aimingPointId = row.aimingPointId || null;
      const allocationId = lines.find(
        (line) =>
          line.targetId === block.targetId &&
          line.aimingPointId === aimingPointId &&
          line.assetId === row.assetId,
      )?.allocationId;
      if (!allocationId) {
        return;
      }
      const existing = drafts.find((draft) => draft.allocationId === allocationId && draft.crewId === row.crewId);
      if (existing) {
        existing.quantity += quantity;
        return;
      }
      drafts.push({ allocationId, crewId: row.crewId, quantity });
    });
  });
  return drafts;
}

export function isPlanReady(blocks: PlanTargetBlock[]): boolean {
  if (blocks.length === 0) {
    return false;
  }
  const assetByCrew = new Map<string, string>();
  for (const block of blocks) {
    if (!block.targetId || block.rows.length === 0) {
      return false;
    }
    for (const row of block.rows) {
      const quantity = parseRequiredNumber(row.quantity);
      if (!row.crewId || !row.assetId || quantity === null || quantity <= 0) {
        return false;
      }
      const previous = assetByCrew.get(row.crewId);
      if (previous && previous !== row.assetId) {
        return false;
      }
      assetByCrew.set(row.crewId, row.assetId);
    }
  }
  return true;
}

export function crewAssetId(blocks: PlanTargetBlock[], crewId: string, exceptRowKey = ""): string {
  if (!crewId) {
    return "";
  }
  for (const block of blocks) {
    for (const row of block.rows) {
      if (row.key !== exceptRowKey && row.crewId === crewId && row.assetId) {
        return row.assetId;
      }
    }
  }
  return "";
}

export function crewOptionState(
  crew: Crew,
  row: PlanForceRow,
  targetId: string,
  blocks: PlanTargetBlock[],
  occupiedCrewIds: ReadonlySet<string>,
  assetLabel: (assetId: string) => string,
): { disabled: boolean; label: string } {
  let samePlace = false;
  let lockedAsset = "";
  blocks.forEach((block) => {
    block.rows.forEach((item) => {
      if (item.key === row.key || item.crewId !== crew.id) {
        return;
      }
      if (block.targetId === targetId && item.aimingPointId === row.aimingPointId) {
        samePlace = true;
      }
      if (item.assetId) {
        lockedAsset = item.assetId;
      }
    });
  });
  const assetConflict = Boolean(lockedAsset && row.assetId && row.assetId !== lockedAsset);
  const occupied = occupiedCrewIds.has(crew.id) && crew.id !== row.crewId;
  let reason = "";
  if (samePlace) {
    reason = DICTIONARY.tasks.crew_allocation.already_added;
  } else if (assetConflict) {
    reason = fillTemplate(DICTIONARY.tasks.crew_allocation.locked_asset, {
      asset: assetLabel(lockedAsset) || DICTIONARY.tasks.crew_allocation.other_asset,
    });
  } else if (occupied) {
    reason = DICTIONARY.tasks.validation.crew_busy;
  }
  return {
    disabled: Boolean(reason),
    label: reason ? `${crew.name} [${reason}]` : crew.name,
  };
}

export function externalAimingUsage(
  tasks: Task[],
  aimingPointId: string,
  organizationId: string,
  assetLabel: (assetId: string) => string,
): SharedAimingUse[] {
  const grouped = new Map<string, SharedAimingUse>();
  tasks.forEach((task) => {
    if (task.archived_at !== null || task.organization_id === organizationId) {
      return;
    }
    task.allocations.forEach((line) => {
      if (line.aiming_point_id !== aimingPointId || line.quantity <= 0) {
        return;
      }
      const key = `${task.organization_id}:${line.asset_id}`;
      const current = grouped.get(key);
      if (current) {
        current.droneCount += line.quantity;
        return;
      }
      grouped.set(key, {
        detachmentId: task.organization_id,
        detachmentName: detachmentName(task.organization_id),
        droneCount: line.quantity,
        droneModel: assetLabel(line.asset_id),
      });
    });
  });
  return [...grouped.values()];
}
