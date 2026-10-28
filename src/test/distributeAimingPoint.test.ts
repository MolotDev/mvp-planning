import { describe, expect, it } from "vitest";
import { distributeForAimingPoint } from "@/lib/distributeAimingPoint";
import type { Crew } from "@/types/battleGroup";
import type { Task } from "@/types/database";

const crews: Crew[] = [
  { id: "1.1.1", name: "1.1.1", organization_id: "detachment_1", platoon_id: "platoon_1_1", is_active: true },
  { id: "1.1.2", name: "1.1.2", organization_id: "detachment_1", platoon_id: "platoon_1_1", is_active: true },
  { id: "1.1.3", name: "1.1.3", organization_id: "detachment_1", platoon_id: "platoon_1_1", is_active: false },
  { id: "1.2.1", name: "1.2.1", organization_id: "detachment_1", platoon_id: "platoon_1_2", is_active: true },
  { id: "1.2.2", name: "1.2.2", organization_id: "detachment_1", platoon_id: "platoon_1_2", is_active: true },
  { id: "1.2.3", name: "1.2.3", organization_id: "detachment_1", platoon_id: "platoon_1_2", is_active: true },
];

function existing(aimingPoint: "MP00" | "MP01", crewId: string, quantity: number): Task {
  return {
    id: `${aimingPoint}-${crewId}`,
    mission_id: "mission",
    detachment_id: "detachment_1",
    platoon_id: "platoon_1_1",
    crew_id: crewId,
    asset_id: "asset",
    aiming_point: aimingPoint,
    planned_quantity: quantity,
    status: "PUBLISHED",
    created_at: "2026-10-26T00:00:00.000Z",
  };
}

describe("distributeForAimingPoint", () => {
  it("splits a quantity across the active crews of one platoon and keeps other aiming points", () => {
    const current = [existing("MP00", "1.1.1", 2), existing("MP00", "1.1.2", 2)];
    const next = distributeForAimingPoint(
      current,
      {
        targetId: "target",
        aimingPoint: "MP01",
        platoonId: "platoon_1_2",
        totalQuantity: 5,
        assetId: "asset",
        detachmentId: "detachment_1",
      },
      crews,
    );

    expect(next.filter((task) => task.aiming_point === "MP00")).toEqual(current);
    expect(next.filter((task) => task.aiming_point === "MP01").map((task) => [task.crew_id, task.planned_quantity])).toEqual([
      ["1.2.1", 2],
      ["1.2.2", 2],
      ["1.2.3", 1],
    ]);
  });
});
