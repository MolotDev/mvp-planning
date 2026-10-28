import { DICTIONARY } from "@/constants/dictionary";
import { aimingCodeFromStored, asAimingCode } from "@/lib/aimingPointCode";
import { detachmentName } from "@/lib/detachments";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import type { CrewAssignmentDraft } from "@/lib/crewAllocation";
import { parseRequiredNumber } from "@/lib/validation";
import type { BattleGroup, Crew } from "@/types/battleGroup";
import { PRIMARY_AIMING_POINT, type Task as StoredTask } from "@/types/database";
import type { Task, TaskAllocation } from "@/types/mission";
import type { AimingPoint } from "@/types/target";

export interface PlanForceRow {
  key: string;
  allocationId: string;
  crewId: string;
  assetId: string;
  quantity: string;
  aimingPointId: string;
  platoonId?: string;
}

export const ENTIRE_PLATOON = "__entire_platoon__";

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
    aimingPointId: PRIMARY_AIMING_POINT,
    platoonId: "",
  };
}

export function unassignedTargetQuantity(task: Task | undefined, targetId: string, rows: PlanForceRow[]): string {
  if (!task || !targetId) {
    return "";
  }
  const planned = task.allocations
    .filter((line) => line.target_id === targetId)
    .reduce((sum, line) => sum + line.quantity, 0);
  const assigned = rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
  const remainder = planned - assigned;
  return remainder > 0 ? String(remainder) : "";
}

export function nextForceRow(block: PlanTargetBlock, assetId: string, quantity: string): PlanForceRow {
  const previous = block.rows[block.rows.length - 1];
  return {
    ...emptyForceRow(),
    assetId,
    quantity,
    aimingPointId: asAimingCode(previous?.aimingPointId ?? PRIMARY_AIMING_POINT),
  };
}

export function emptyPlanTarget(): PlanTargetBlock {
  return { key: crypto.randomUUID(), targetId: "", rows: [] };
}

/** Bind a catalog target into a plan block and seed the first empty force row with MP00 (or given code). */
export function planBlockForTarget(
  targetId: string,
  aimingPointId: string = PRIMARY_AIMING_POINT,
  existing?: PlanTargetBlock | null,
): PlanTargetBlock {
  const base = existing ?? emptyPlanTarget();
  const firstRow: PlanForceRow = {
    ...emptyForceRow(),
    aimingPointId: asAimingCode(aimingPointId),
  };
  return {
    ...base,
    targetId,
    rows: [firstRow],
  };
}

export function primaryAimingPointId(
  _aimingPoints: Array<{ id: string; target_id: string; displayed_id: string; archived_at: string | null }>,
  _targetId: string,
): string {
  return PRIMARY_AIMING_POINT;
}

function splitAllocation(block: PlanTargetBlock, row: PlanForceRow): string {
  const shared = block.rows.some((other) => other.key !== row.key && other.allocationId === row.allocationId);
  return shared ? crypto.randomUUID() : row.allocationId;
}

export function assignPlanAimingPoint(block: PlanTargetBlock, rowKey: string, aimingPointId: string): PlanTargetBlock {
  const nextCode = asAimingCode(aimingPointId);
  return {
    ...block,
    rows: block.rows.map((row) => {
      if (row.key !== rowKey || row.aimingPointId === nextCode) {
        return row;
      }
      return { ...row, aimingPointId: nextCode, allocationId: splitAllocation(block, row) };
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

export function planBlocksFromTask(
  task: Task,
  groups: BattleGroup[],
  aimingPoints: AimingPoint[] = [],
): PlanTargetBlock[] {
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
    const aimingCode = aimingCodeFromStored(
      line.aiming_point_id,
      aimingPoints.filter((point) => point.target_id === line.target_id),
    );
    crews.forEach((group) => {
      block?.rows.push({
        key: group.id,
        allocationId: line.id,
        crewId: group.lead_crew_id,
        assetId: line.asset_id,
        quantity: group.uav_quantity ? String(group.uav_quantity) : "",
        aimingPointId: aimingCode,
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
        aimingPointId: aimingCode,
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
      const aimingPointId = asAimingCode(row.aimingPointId);
      const key = `${block.targetId}\0${aimingPointId}\0${row.assetId}`;
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
    aiming_point_id: asAimingCode(line.aimingPointId),
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
  for (const block of blocks) {
    if (!block.targetId || block.rows.length === 0) {
      return false;
    }
    for (const row of block.rows) {
      const quantity = parseRequiredNumber(row.quantity);
      if (!row.crewId || !row.assetId || quantity === null || quantity <= 0) {
        return false;
      }
      const lockedAssetId = getCrewAssignedAssets(planRowsAsTasks(blocks, row.key)).get(row.crewId);
      if (lockedAssetId && lockedAssetId !== row.assetId) {
        return false;
      }
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

export function getAvailablePlatoonCrews(
  platoonId: string,
  detachmentId: string,
  allCrews: Crew[],
  currentTasks: Array<{ crew_id: string | null }>,
): Crew[] {
  const busyCrewIds = new Set(
    currentTasks.map((task) => task.crew_id).filter((id): id is string => Boolean(id)),
  );
  return allCrews.filter(
    (crew) =>
      crew.organization_id === detachmentId &&
      crew.platoon_id === platoonId &&
      crew.is_active &&
      !busyCrewIds.has(crew.id),
  );
}

export function planRowsAsTasks(
  blocks: PlanTargetBlock[],
  exceptRowKey = "",
): Array<Pick<StoredTask, "crew_id" | "asset_id">> {
  return blocks.flatMap((block) =>
    block.rows
      .filter((row) => row.key !== exceptRowKey)
      .map((row) => ({ crew_id: row.crewId || null, asset_id: row.assetId })),
  );
}

/**
 * Повертає Map<crewId, assetId>, де зафіксовано, за яким засобом уже закріплений екіпаж у формі
 */
export function getCrewAssignedAssets(
  tasks: ReadonlyArray<Pick<StoredTask, "crew_id" | "asset_id">>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const task of tasks) {
    if (task.crew_id && task.asset_id) {
      map.set(task.crew_id, task.asset_id);
    }
  }
  return map;
}

function evenShares(total: number, count: number): number[] {
  if (total <= 0 || count <= 0) {
    return [];
  }
  const base = Math.floor(total / count);
  const extra = total % count;
  return Array.from({ length: count }, (_, index) => base + (index < extra ? 1 : 0));
}

export function describeEvenShares(total: number, count: number): string {
  return evenShares(total, count)
    .filter((share) => share > 0)
    .join(", ");
}

export function platoonDistributionLabel(
  platoonName: string,
  freeCount: number,
  totalCount: number,
  quantity: number,
): { label: string; disabled: boolean } {
  const ratio = `(${freeCount}/${totalCount})`;
  const columns = DICTIONARY.tasks.allocation;
  if (freeCount === 0) {
    return {
      disabled: true,
      label: fillTemplate(columns.split_platoon_busy, { platoon: platoonName, ratio }),
    };
  }
  if (quantity < freeCount) {
    return {
      disabled: true,
      label: fillTemplate(columns.split_platoon_min, { platoon: platoonName, ratio, free: freeCount }),
    };
  }
  return {
    disabled: false,
    label: fillTemplate(columns.split_platoon, {
      platoon: platoonName,
      ratio,
      shares: describeEvenShares(quantity, freeCount),
    }),
  };
}

export const PLATOON_ACTION = "__platoon__:";

export function fanOutPlanRow(
  block: PlanTargetBlock,
  rowKey: string,
  platoonId: string,
  detachmentId: string,
  crews: Crew[],
  blocks: PlanTargetBlock[],
): PlanTargetBlock | null {
  const index = block.rows.findIndex((row) => row.key === rowKey);
  const row = block.rows[index];
  const total = Number(row?.quantity);
  if (!row || !platoonId || !row.assetId || !Number.isInteger(total) || total <= 0) {
    return null;
  }
  const eligible = getAvailablePlatoonCrews(
    platoonId,
    detachmentId,
    crews,
    planRowsAsTasks(blocks, row.key),
  ).sort((left, right) => left.id.localeCompare(right.id, "uk"));
  if (eligible.length === 0 || total < eligible.length) {
    return null;
  }
  const created = evenShares(total, eligible.length).flatMap((quantity, shareIndex) => {
    const crew = eligible[shareIndex];
    if (!crew || quantity <= 0) {
      return [];
    }
    const createdRow: PlanForceRow = {
      key: crypto.randomUUID(),
      allocationId: row.allocationId,
      crewId: crew.id,
      assetId: row.assetId,
      quantity: String(quantity),
      aimingPointId: row.aimingPointId,
      platoonId,
    };
    return [createdRow];
  });
  if (created.length === 0) {
    return null;
  }
  const rows = [...block.rows];
  rows.splice(index, 1, ...created);
  return { ...block, rows };
}

function assetLockedToCrew(blocks: PlanTargetBlock[], crewId: string, ignoredRowKeys: ReadonlySet<string>): string {
  for (const block of blocks) {
    for (const row of block.rows) {
      if (ignoredRowKeys.has(row.key) || row.crewId !== crewId || !row.assetId) {
        continue;
      }
      return row.assetId;
    }
  }
  return "";
}

export function distributeCrewDrafts(
  allocations: TaskAllocation[],
  crews: Crew[],
  occupiedCrewIds: ReadonlySet<string>,
): CrewAssignmentDraft[] {
  const assignedAsset = new Map<string, string>();
  const drafts: CrewAssignmentDraft[] = [];
  allocations.forEach((allocation) => {
    if (allocation.quantity <= 0 || !allocation.asset_id) {
      return;
    }
    const eligible = crews
      .filter((crew) => crew.is_active && !occupiedCrewIds.has(crew.id))
      .filter((crew) => {
        const locked = assignedAsset.get(crew.id);
        return !locked || locked === allocation.asset_id;
      })
      .sort((left, right) => left.platoon_id.localeCompare(right.platoon_id) || left.id.localeCompare(right.id, "uk"));
    evenShares(allocation.quantity, eligible.length).forEach((quantity, index) => {
      if (quantity <= 0) {
        return;
      }
      const crew = eligible[index];
      assignedAsset.set(crew.id, allocation.asset_id);
      drafts.push({ allocationId: allocation.id, crewId: crew.id, quantity });
    });
  });
  return drafts;
}

export function distributePlanEvenly(
  blocks: PlanTargetBlock[],
  crews: Crew[],
  occupiedCrewIds: ReadonlySet<string>,
): PlanTargetBlock[] {
  const assignedAsset = new Map<string, string>();
  return blocks.map((block) => {
    const pools = new Map<string, PlanForceRow[]>();
    const untouched: PlanForceRow[] = [];
    block.rows.forEach((row) => {
      const quantity = parseRequiredNumber(row.quantity);
      if (!row.assetId || quantity === null || quantity <= 0) {
        untouched.push(row);
        return;
      }
      const key = `${row.aimingPointId}\0${row.assetId}`;
      const pool = pools.get(key) ?? [];
      pool.push(row);
      pools.set(key, pool);
    });
    const nextRows = [...untouched];
    pools.forEach((rows) => {
      const total = rows.reduce((sum, row) => sum + (parseRequiredNumber(row.quantity) ?? 0), 0);
      const assetId = rows[0].assetId;
      const ignored = new Set(rows.map((row) => row.key));
      const eligible = crews
        .filter((crew) => crew.is_active && !occupiedCrewIds.has(crew.id))
        .filter((crew) => {
          const locked = assignedAsset.get(crew.id) || assetLockedToCrew(blocks, crew.id, ignored);
          return !locked || locked === assetId;
        })
        .sort((left, right) => left.platoon_id.localeCompare(right.platoon_id) || left.id.localeCompare(right.id, "uk"));
      if (eligible.length === 0) {
        nextRows.push(...rows);
        return;
      }
      evenShares(total, eligible.length).forEach((quantity, index) => {
        if (quantity <= 0) {
          return;
        }
        const crew = eligible[index];
        assignedAsset.set(crew.id, assetId);
        nextRows.push({
          key: crypto.randomUUID(),
          allocationId: rows[0].allocationId,
          crewId: crew.id,
          assetId,
          quantity: String(quantity),
          aimingPointId: rows[0].aimingPointId,
        });
      });
    });
    return { ...block, rows: nextRows };
  });
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
