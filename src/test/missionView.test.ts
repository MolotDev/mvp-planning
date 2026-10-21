import { describe, expect, it } from "vitest";
import { splitMissionsByTarget } from "@/lib/missionView";
import type { Mission, Task } from "@/types/mission";
import type { Target } from "@/types/target";

function mission(partial: Partial<Mission> & Pick<Mission, "id" | "label" | "created_at">): Mission {
  return {
    name: null,
    scheduled_at: partial.created_at,
    description: "",
    task_ids: [],
    updated_at: partial.created_at,
    reported_at: null,
    confirmed_at: null,
    archived_at: null,
    ...partial,
  };
}

function target(id: string, name: string): Target {
  return {
    id,
    label: id,
    displayed_id: "",
    name,
    address: "",
    type: "",
    distance_from_hot_line: 0,
    mgrs: "",
    created_at: "",
    updated_at: "",
    archived_at: null,
    aiming_point_ids: [],
    image_url: null,
  };
}

describe("splitMissionsByTarget", () => {
  it("keeps a single-target mission label and suffixes each target of a multi-target mission", () => {
    const earlier = mission({ id: "m2", label: "MN-2", name: "Заграва", created_at: "2026-10-17T09:00:00.000Z" });
    const later = mission({ id: "m3", label: "MN-3", name: "Килим", created_at: "2026-10-18T09:00:00.000Z" });
    const tasks: Task[] = [
      {
        id: "t2",
        label: "TK-2",
        organization_id: "detachment_2",
        mission_id: "m2",
        source: "center",
        scheduled_at: earlier.scheduled_at,
        allocations: [
          { id: "a2", mission_id: "m2", target_id: "target-2", aiming_point_id: "ap-3", asset_id: "uav_2", quantity: 2 },
        ],
        battle_groups_ids: [],
        fact_submitted_at: null,
        fact_notes: null,
        created_at: earlier.created_at,
        updated_at: earlier.created_at,
        reported_at: null,
        archived_at: null,
      },
      {
        id: "t3",
        label: "TK-3",
        organization_id: "detachment_1",
        mission_id: "m3",
        source: "center",
        scheduled_at: later.scheduled_at,
        allocations: [
          { id: "a1", mission_id: "m3", target_id: "target-1", aiming_point_id: "ap-1", asset_id: "uav_1", quantity: 7 },
          { id: "a1b", mission_id: "m3", target_id: "target-1", aiming_point_id: "ap-2", asset_id: "uav_1", quantity: 4 },
          { id: "a3", mission_id: "m3", target_id: "target-2", aiming_point_id: "ap-3", asset_id: "uav_1", quantity: 11 },
        ],
        battle_groups_ids: [],
        fact_submitted_at: null,
        fact_notes: null,
        created_at: later.created_at,
        updated_at: later.created_at,
        reported_at: null,
        archived_at: null,
      },
    ];

    const cards = splitMissionsByTarget(
      [later, earlier],
      tasks,
      [target("target-1", "Склад"), target("target-2", "Контрольний пункт")],
    );

    expect(cards.map((card) => card.label)).toEqual(["MN-2", "MN-3.1", "MN-3.2"]);
    expect(cards[1]?.title).toBe("Килим — Склад");
    expect(cards[2]?.title).toBe("Килим — Контрольний пункт");
    expect(cards[1]?.targetId).toBe("target-1");
  });
});
