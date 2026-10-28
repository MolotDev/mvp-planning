import type { CrewAssignmentDraft } from "@/lib/crewAllocation";
import type { Crew } from "@/types/battleGroup";
import { PRIMARY_AIMING_POINT, type AimingPointCode, type Task } from "@/types/database";
import type { TaskAllocation } from "@/types/mission";

export interface AimingDistributionRow {
  key: string;
  allocationId: string;
  crewId: string;
  assetId: string;
  quantity: string;
  aimingPointId: string;
}

export function asAimingCode(code: string): AimingPointCode {
  return /^MP\d{2}$/.test(code) ? (code as AimingPointCode) : PRIMARY_AIMING_POINT;
}

export interface DistributeTpParams {
  targetId: string;
  aimingPoint: AimingPointCode;
  platoonId: string;
  totalQuantity: number;
  assetId: string;
  detachmentId: string;
}

export function distributeForAimingPoint(currentTasks: Task[], params: DistributeTpParams, crews: Crew[]): Task[] {
  const { aimingPoint, platoonId, totalQuantity, assetId, detachmentId } = params;
  const targetCrews = crews.filter(
    (crew) => crew.platoon_id === platoonId && crew.organization_id === detachmentId && crew.is_active,
  );

  if (targetCrews.length === 0 || totalQuantity <= 0) {
    return currentTasks;
  }

  const base = Math.floor(totalQuantity / targetCrews.length);
  const remainder = totalQuantity % targetCrews.length;
  const createdAt = new Date().toISOString();
  const newTasksForTp = targetCrews.flatMap((crew, index) => {
    const qty = base + (index < remainder ? 1 : 0);
    if (qty <= 0) {
      return [];
    }
    const task: Task = {
      id: crypto.randomUUID(),
      mission_id: "",
      detachment_id: detachmentId,
      platoon_id: platoonId,
      crew_id: crew.id,
      asset_id: assetId,
      aiming_point: aimingPoint,
      planned_quantity: qty,
      status: "PUBLISHED",
      created_at: createdAt,
    };
    return [task];
  });
  const otherTasks = currentTasks.filter((task) => task.aiming_point !== aimingPoint);
  return [...otherTasks, ...newTasksForTp];
}

function taskFromDraft(
  draft: CrewAssignmentDraft,
  allocation: TaskAllocation,
  aimingPoint: AimingPointCode,
  detachmentId: string,
  crews: Crew[],
): Task {
  return {
    id: `${allocation.id}:${draft.crewId}`,
    mission_id: allocation.mission_id,
    detachment_id: detachmentId,
    platoon_id: crews.find((crew) => crew.id === draft.crewId)?.platoon_id ?? null,
    crew_id: draft.crewId,
    asset_id: allocation.asset_id,
    aiming_point: aimingPoint,
    planned_quantity: draft.quantity,
    status: "PUBLISHED",
    created_at: new Date().toISOString(),
  };
}

export function distributeAllocationDrafts(
  drafts: CrewAssignmentDraft[],
  allocations: TaskAllocation[],
  allocationId: string,
  aimingCode: AimingPointCode,
  platoonId: string,
  totalQuantity: number,
  detachmentId: string,
  crews: Crew[],
  codeForAllocation: (allocation: TaskAllocation) => AimingPointCode,
): CrewAssignmentDraft[] {
  const clicked = allocations.find((allocation) => allocation.id === allocationId);
  if (!clicked) {
    return drafts;
  }
  const sameTarget = new Set(
    allocations.filter((allocation) => allocation.target_id === clicked.target_id).map((allocation) => allocation.id),
  );
  const outside = drafts.filter((draft) => !sameTarget.has(draft.allocationId));
  const inside = drafts.flatMap((draft) => {
    const allocation = allocations.find((item) => item.id === draft.allocationId);
    if (!allocation || !sameTarget.has(allocation.id)) {
      return [];
    }
    return [taskFromDraft(draft, allocation, codeForAllocation(allocation), detachmentId, crews)];
  });
  const next = distributeForAimingPoint(
    inside,
    {
      targetId: clicked.target_id,
      aimingPoint: aimingCode,
      platoonId,
      totalQuantity,
      assetId: clicked.asset_id,
      detachmentId,
    },
    crews,
  );
  return [
    ...outside,
    ...next.flatMap((task) => {
      if (!task.crew_id || task.planned_quantity <= 0) {
        return [];
      }
      const owner =
        task.aiming_point === aimingCode && task.asset_id === clicked.asset_id
          ? clicked
          : allocations.find(
              (allocation) =>
                sameTarget.has(allocation.id) &&
                allocation.asset_id === task.asset_id &&
                codeForAllocation(allocation) === task.aiming_point,
            );
      if (!owner) {
        return [];
      }
      return [{ allocationId: owner.id, crewId: task.crew_id, quantity: task.planned_quantity }];
    }),
  ];
}

export function replaceAimingRows(
  rows: AimingDistributionRow[],
  aimingPointId: string,
  params: DistributeTpParams,
  crews: Crew[],
): AimingDistributionRow[] {
  const rest = rows.filter((row) => row.aimingPointId !== aimingPointId);
  const current = rows.filter((row) => row.aimingPointId === aimingPointId && row.crewId);
  const allocationId = rows.find((row) => row.aimingPointId === aimingPointId)?.allocationId ?? crypto.randomUUID();
  const next = distributeForAimingPoint(
    current.map((row) => ({
      id: row.key,
      mission_id: "",
      detachment_id: params.detachmentId,
      platoon_id: crews.find((crew) => crew.id === row.crewId)?.platoon_id ?? null,
      crew_id: row.crewId,
      asset_id: row.assetId || params.assetId,
      aiming_point: params.aimingPoint,
      planned_quantity: Number(row.quantity) || 0,
      status: "PUBLISHED",
      created_at: new Date().toISOString(),
    })),
    params,
    crews,
  );
  return [
    ...rest,
    ...next.flatMap((task) => {
      if (task.aiming_point !== params.aimingPoint || !task.crew_id || task.planned_quantity <= 0) {
        return [];
      }
      return [
        {
          key: crypto.randomUUID(),
          allocationId,
          crewId: task.crew_id,
          assetId: params.assetId,
          quantity: String(task.planned_quantity),
          aimingPointId,
        },
      ];
    }),
  ];
}
