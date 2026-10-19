import { describe, expect, it } from "vitest";
import { scopesFromRows } from "@/components/launches/LaunchGroupCards";
import type { BattleGroup } from "@/types/battleGroup";
import type { Launch } from "@/types/launch";
import type { Task } from "@/types/mission";
import type { LaunchRowContext } from "@/lib/launchBoard";

const task = { id: "task-1", allocations: [] } as unknown as Task;

function group(id: string, crewId: string, assetId: string): BattleGroup {
  return {
    id,
    task_id: "task-1",
    lead_crew_id: crewId,
    support_crew_ids: [],
    asset_id: assetId,
    allocation_line_id: id,
    uav_quantity: 1,
    created_at: "",
    updated_at: "",
    archived_at: null,
  };
}

function row(launchId: string, battleGroup: BattleGroup): LaunchRowContext {
  return {
    launch: { id: launchId, battle_group_id: battleGroup.id, asset_id: battleGroup.asset_id } as Launch,
    task,
    mission: undefined,
    target: undefined,
    aimingPoint: undefined,
    battleGroup,
  };
}

describe("scopesFromRows", () => {
  it("keeps one card for one crew and one asset across aiming points", () => {
    const first = group("bg-1", "1.1.1", "uav_1");
    const second = group("bg-2", "1.1.1", "uav_1");
    const scopes = scopesFromRows([row("l-1", first), row("l-2", second)], "battle_group");
    expect(scopes).toHaveLength(1);
    expect(scopes[0].launches.map((launch) => launch.id)).toEqual(["l-1", "l-2"]);
    expect(scopes[0].battleGroups?.map((item) => item.id)).toEqual(["bg-1", "bg-2"]);
  });

  it("keeps separate cards when the asset differs", () => {
    const scopes = scopesFromRows(
      [row("l-1", group("bg-1", "1.1.1", "uav_1")), row("l-2", group("bg-2", "1.1.1", "uav_2"))],
      "battle_group",
    );
    expect(scopes).toHaveLength(2);
  });
});
