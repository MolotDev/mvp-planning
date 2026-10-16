import { DICTIONARY } from "@/constants/dictionary";
import { fillTemplate } from "@/lib/battleGroupCapacity";
import type { Crew } from "@/types/battleGroup";
import type { TaskAllocation } from "@/types/mission";

export interface CrewAssignmentDraft {
  allocationId: string;
  crewId: string;
  quantity: number;
}

export interface CrewOption extends Crew {
  isDisabled: boolean;
  disabledReason: string;
}

export function getRemaining(alloc: TaskAllocation, drafts: CrewAssignmentDraft[]): number {
  const assigned = drafts
    .filter((draft) => draft.allocationId === alloc.id)
    .reduce((sum, draft) => sum + draft.quantity, 0);
  return alloc.quantity - assigned;
}

export function getCrewAssignedAssetMap(
  drafts: CrewAssignmentDraft[],
  allocations: TaskAllocation[],
): Record<string, string> {
  const map: Record<string, string> = {};
  drafts.forEach((draft) => {
    const allocation = allocations.find((item) => item.id === draft.allocationId);
    if (allocation) {
      map[draft.crewId] = allocation.asset_id;
    }
  });
  return map;
}

export function getAvailableCrewOptions(
  allCrews: Crew[],
  currentAllocation: TaskAllocation,
  currentBucketAssignedCrewIds: string[],
  crewAssetMap: Record<string, string>,
  getAssetName: (id: string) => string,
  occupiedCrewIds: ReadonlySet<string> = new Set(),
): CrewOption[] {
  return allCrews.map((crew) => {
    const assignedAssetId = crewAssetMap[crew.id];
    const isAlreadyInThisBucket = currentBucketAssignedCrewIds.includes(crew.id);
    const isLockedToDifferentAsset = Boolean(assignedAssetId && assignedAssetId !== currentAllocation.asset_id);
    const isOccupiedElsewhere = occupiedCrewIds.has(crew.id);
    const isDisabled = isAlreadyInThisBucket || isLockedToDifferentAsset || isOccupiedElsewhere;
    let disabledReason = "";
    if (isAlreadyInThisBucket) {
      disabledReason = DICTIONARY.tasks.crew_allocation.already_added;
    } else if (isLockedToDifferentAsset) {
      disabledReason = fillTemplate(DICTIONARY.tasks.crew_allocation.locked_asset, {
        asset: getAssetName(assignedAssetId) || DICTIONARY.tasks.crew_allocation.other_asset,
      });
    } else if (isOccupiedElsewhere) {
      disabledReason = DICTIONARY.tasks.validation.crew_busy;
    }
    return {
      ...crew,
      isDisabled,
      disabledReason,
    };
  });
}
