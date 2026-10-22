import { describe, expect, it } from "vitest";
import { allocationsFromBlocks, crewDraftsFromBlocks, crewOptionState, externalAimingUsage, type PlanForceRow, type PlanTargetBlock } from "@/lib/detachmentPlan";
import { taskBelongsToMission } from "@/lib/taskAllocations";
import type { Crew } from "@/types/battleGroup";
import type { Task } from "@/types/mission";

function task(organizationId: string, aimingPointId: string, assetId: string, quantity: number): Task {
  return {
    id: `${organizationId}-${aimingPointId}`,
    label: organizationId,
    organization_id: organizationId,
    mission_id: "mission",
    source: "center",
    scheduled_at: "",
    allocations: [
      {
        id: `${organizationId}-line`,
        mission_id: "mission",
        target_id: "target",
        aiming_point_id: aimingPointId,
        asset_id: assetId,
        quantity,
      },
    ],
    battle_groups_ids: [],
    fact_submitted_at: null,
    fact_notes: null,
    created_at: "",
    updated_at: "",
    reported_at: null,
    archived_at: null,
  };
}

function block(): PlanTargetBlock {
  return {
    key: "target-block",
    targetId: "target-1",
    rows: [
      {
        key: "row-1",
        allocationId: "line-1",
        crewId: "1.1.1",
        assetId: "uav_1",
        quantity: "2",
        aimingPointId: "point-1",
      },
      {
        key: "row-2",
        allocationId: "line-2",
        crewId: "1.1.2",
        assetId: "uav_1",
        quantity: "3",
        aimingPointId: "point-1",
      },
    ],
  };
}

describe("detachment target extension", () => {
  it("keeps one allocation when two crews share an aiming point and asset", () => {
    const lines = allocationsFromBlocks([block()], "mission-1");
    expect(lines).toEqual([
      {
        id: "line-1",
        mission_id: "mission-1",
        target_id: "target-1",
        aiming_point_id: "point-1",
        asset_id: "uav_1",
        quantity: 5,
      },
    ]);
    expect(crewDraftsFromBlocks([block()])).toEqual([
      { allocationId: "line-1", crewId: "1.1.1", quantity: 2 },
      { allocationId: "line-1", crewId: "1.1.2", quantity: 3 },
    ]);
  });

  it("lets the same crew take another target only with the asset already chosen", () => {
    const crew: Crew = { id: "1.1.1", name: "1.1.1", organization_id: "detachment_1" };
    const row = (key: string, assetId: string, aimingPointId: string): PlanForceRow => ({
      key,
      allocationId: key,
      crewId: key === "other" ? "1.1.1" : "",
      assetId,
      quantity: "1",
      aimingPointId,
    });
    const blocks: PlanTargetBlock[] = [
      { key: "t1", targetId: "target-1", rows: [row("other", "uav_2", "point-1")] },
      { key: "t2", targetId: "target-2", rows: [row("next", "", "point-2")] },
    ];
    const open = crewOptionState(crew, blocks[1].rows[0], "target-2", blocks, new Set(), (id) => (id === "uav_2" ? "Сова" : "Ворон"));
    expect(open.disabled).toBe(false);
    const conflict = crewOptionState(
      crew,
      { ...blocks[1].rows[0], assetId: "uav_1" },
      "target-2",
      blocks,
      new Set(),
      (id) => (id === "uav_2" ? "Сова" : "Ворон"),
    );
    expect(conflict.disabled).toBe(true);
    expect(conflict.label).toContain("Сова");
  });

  it("reports other detachments on an aiming point and skips the current detachment", () => {
    const usage = externalAimingUsage(
      [
        task("detachment_1", "point-1", "uav_1", 4),
        task("detachment_2", "point-1", "uav_2", 2),
      ],
      "point-1",
      "detachment_1",
      (assetId) => (assetId === "uav_2" ? "Сова" : "Ворон"),
    );
    expect(usage).toEqual([
      {
        detachmentId: "detachment_2",
        detachmentName: "2_Загін",
        droneCount: 2,
        droneModel: "Сова",
      },
    ]);
  });

  it("links a detachment task to the daily mission by mission id", () => {
    const request = task("detachment_1", "point-1", "uav_2", 1);
    request.mission_id = "daily";
    request.allocations = request.allocations.map((line) => ({ ...line, mission_id: "" }));
    const mission = { id: "daily", task_ids: [request.id] };
    expect(taskBelongsToMission(request, mission)).toBe(true);
    expect(taskBelongsToMission(request, { id: "other", task_ids: [] })).toBe(false);
  });
});
