import { describe, expect, it } from "vitest";
import { allocationsFromBlocks, crewDraftsFromBlocks, crewOptionState, distributePlanEvenly, externalAimingUsage, fanOutPlanRow, getAvailablePlatoonCrews, getCrewAssignedAssets, isPlanReady, nextForceRow, planRowsAsTasks, platoonDistributionLabel, type PlanForceRow, type PlanTargetBlock } from "@/lib/detachmentPlan";
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
    confirmed_at: null,
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
        aimingPointId: "MP00",
      },
      {
        key: "row-2",
        allocationId: "line-2",
        crewId: "1.1.2",
        assetId: "uav_1",
        quantity: "3",
        aimingPointId: "MP00",
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
        aiming_point_id: "MP00",
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
    const crew: Crew = { id: "1.1.1", name: "1.1.1", organization_id: "detachment_1", platoon_id: "platoon_1_1", is_active: true };
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

  it("splits a quantity evenly across active crews and skips a busy crew", () => {
    const crews: Crew[] = [
      { id: "1.1.1", name: "1.1.1", organization_id: "detachment_1", platoon_id: "platoon_1_1", is_active: true },
      { id: "1.1.2", name: "1.1.2", organization_id: "detachment_1", platoon_id: "platoon_1_1", is_active: false },
      { id: "1.2.1", name: "1.2.1", organization_id: "detachment_1", platoon_id: "platoon_1_2", is_active: true },
      { id: "1.2.2", name: "1.2.2", organization_id: "detachment_1", platoon_id: "platoon_1_2", is_active: true },
    ];
    const source: PlanTargetBlock = {
      key: "target-block",
      targetId: "target-1",
      rows: [
        {
          key: "row-1",
          allocationId: "line-1",
          crewId: "",
          assetId: "uav_1",
          quantity: "5",
          aimingPointId: "point-1",
        },
      ],
    };
    const [next] = distributePlanEvenly([source], crews, new Set(["1.2.2"]));
    expect(next.rows.map((row) => ({ crewId: row.crewId, quantity: row.quantity }))).toEqual([
      { crewId: "1.1.1", quantity: "3" },
      { crewId: "1.2.1", quantity: "2" },
    ]);
  });

  it("fans one row across the chosen platoon and keeps another aiming point", () => {
    const crews: Crew[] = [
      { id: "1.1.1", name: "1.1.1", organization_id: "detachment_1", platoon_id: "platoon_1_1", is_active: true },
      { id: "1.1.2", name: "1.1.2", organization_id: "detachment_1", platoon_id: "platoon_1_1", is_active: true },
      { id: "1.1.3", name: "1.1.3", organization_id: "detachment_1", platoon_id: "platoon_1_1", is_active: false },
      { id: "1.2.1", name: "1.2.1", organization_id: "detachment_1", platoon_id: "platoon_1_2", is_active: true },
    ];
    const source: PlanTargetBlock = {
      key: "target-block",
      targetId: "target-1",
      rows: [
        {
          key: "kept",
          allocationId: "line-0",
          crewId: "1.2.1",
          assetId: "uav_1",
          quantity: "2",
          aimingPointId: "MP00",
          platoonId: "platoon_1_2",
        },
        {
          key: "open",
          allocationId: "line-1",
          crewId: "",
          assetId: "uav_1",
          quantity: "5",
          aimingPointId: "MP01",
          platoonId: "platoon_1_1",
        },
      ],
    };
    const next = fanOutPlanRow(source, "open", "platoon_1_1", "detachment_1", crews, [source]);
    expect(next?.rows[0]).toMatchObject({ key: "kept", aimingPointId: "MP00", quantity: "2" });
    expect(next?.rows.slice(1).map((row) => ({ crewId: row.crewId, quantity: row.quantity, aimingPointId: row.aimingPointId }))).toEqual([
      { crewId: "1.1.1", quantity: "3", aimingPointId: "MP01" },
      { crewId: "1.1.2", quantity: "2", aimingPointId: "MP01" },
    ]);
    const added = nextForceRow(source, "uav_1", "1");
    expect(added).toMatchObject({ assetId: "uav_1", quantity: "1", aimingPointId: "MP01", crewId: "", platoonId: "" });
  });

  it("splits a platoon only across crews that are not already on a form row", () => {
    const crews: Crew[] = [
      { id: "1.1.1", name: "1.1.1", organization_id: "detachment_1", platoon_id: "platoon_1_1", is_active: true },
      { id: "1.1.2", name: "1.1.2", organization_id: "detachment_1", platoon_id: "platoon_1_1", is_active: true },
      { id: "1.1.3", name: "1.1.3", organization_id: "detachment_1", platoon_id: "platoon_1_1", is_active: true },
      { id: "1.2.1", name: "1.2.1", organization_id: "detachment_1", platoon_id: "platoon_1_2", is_active: true },
    ];
    const source: PlanTargetBlock = {
      key: "target-block",
      targetId: "target-1",
      rows: [
        {
          key: "busy",
          allocationId: "line-0",
          crewId: "1.1.1",
          assetId: "uav_2",
          quantity: "1",
          aimingPointId: "mp00",
        },
        {
          key: "open",
          allocationId: "line-1",
          crewId: "",
          assetId: "uav_1",
          quantity: "5",
          aimingPointId: "mp01",
        },
      ],
    };
    expect(getAvailablePlatoonCrews("platoon_1_1", "detachment_1", crews, [{ crew_id: "1.1.1" }]).map((crew) => crew.id)).toEqual([
      "1.1.2",
      "1.1.3",
    ]);
    const next = fanOutPlanRow(source, "open", "platoon_1_1", "detachment_1", crews, [source]);
    expect(next?.rows.map((row) => ({ crewId: row.crewId, quantity: row.quantity }))).toEqual([
      { crewId: "1.1.1", quantity: "1" },
      { crewId: "1.1.2", quantity: "3" },
      { crewId: "1.1.3", quantity: "2" },
    ]);
    const full: PlanTargetBlock = {
      ...source,
      rows: [
        ...source.rows.filter((row) => row.key === "busy"),
        { ...source.rows[0], key: "busy-2", crewId: "1.1.2" },
        { ...source.rows[0], key: "busy-3", crewId: "1.1.3" },
        source.rows[1],
      ],
    };
    expect(fanOutPlanRow(full, "open", "platoon_1_1", "detachment_1", crews, [full])).toBeNull();
    expect(platoonDistributionLabel("1-й Взвод", 3, 3, 58)).toEqual({
      disabled: false,
      label: "⚡ Розділити на 1-й Взвод (3/3) -> (по 20, 19, 19)",
    });
    expect(platoonDistributionLabel("1-й Взвод", 2, 3, 58)).toEqual({
      disabled: false,
      label: "⚡ Розділити на 1-й Взвод (2/3) -> (по 29, 29)",
    });
    expect(platoonDistributionLabel("1-й Взвод", 0, 3, 5)).toEqual({
      disabled: true,
      label: "⚡ Розділити на 1-й Взвод (0/3) — всі задіяні",
    });
    expect(platoonDistributionLabel("1-й Взвод", 3, 3, 2)).toEqual({
      disabled: true,
      label: "⚡ Розділити на 1-й Взвод (3/3) — мін. 3 борт(ів)",
    });
    const short: PlanTargetBlock = {
      ...source,
      rows: [{ ...source.rows[1], quantity: "1" }],
    };
    expect(fanOutPlanRow(short, "open", "platoon_1_1", "detachment_1", crews, [short])).toBeNull();
  });

  it("locks a crew to one asset inside the current form", () => {
    expect(
      getCrewAssignedAssets([
        { crew_id: "1.1.1", asset_id: "uav_1" },
        { crew_id: "1.1.2", asset_id: "uav_2" },
        { crew_id: null, asset_id: "uav_3" },
      ]).get("1.1.1"),
    ).toBe("uav_1");
    const row = (key: string, crewId: string, assetId: string): PlanForceRow => ({
      key,
      allocationId: key,
      crewId,
      assetId,
      quantity: "1",
      aimingPointId: "mp00",
    });
    const same: PlanTargetBlock[] = [
      { key: "t", targetId: "target-1", rows: [row("a", "1.1.1", "uav_1"), row("b", "1.1.1", "uav_1")] },
    ];
    const conflict: PlanTargetBlock[] = [
      { key: "t", targetId: "target-1", rows: [row("a", "1.1.1", "uav_1"), row("b", "1.1.1", "uav_2")] },
    ];
    expect(isPlanReady(same)).toBe(true);
    expect(isPlanReady(conflict)).toBe(false);
    expect(getCrewAssignedAssets(planRowsAsTasks(conflict, "b")).get("1.1.1")).toBe("uav_1");
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
