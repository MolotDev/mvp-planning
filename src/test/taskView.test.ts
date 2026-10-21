import { describe, expect, it } from "vitest";
import { splitTasksByTarget } from "@/lib/taskView";
import type { Mission, Task } from "@/types/mission";
import type { Target } from "@/types/target";

function mission(id: string, label: string, name: string): Mission {
  return {
    id,
    label,
    name,
    scheduled_at: "2026-10-18T09:00:00.000Z",
    description: "",
    task_ids: [],
    created_at: "2026-10-18T09:00:00.000Z",
    updated_at: "2026-10-18T09:00:00.000Z",
    reported_at: null,
    confirmed_at: null,
    archived_at: null,
  };
}

function task(partial: Partial<Task> & Pick<Task, "id" | "label" | "created_at" | "allocations">): Task {
  return {
    organization_id: "detachment_1",
    mission_id: null,
    source: "center",
    scheduled_at: partial.created_at,
    battle_groups_ids: [],
    fact_submitted_at: null,
    fact_notes: null,
    updated_at: partial.created_at,
    reported_at: null,
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

describe("splitTasksByTarget", () => {
  it("keeps a single-target task label and suffixes each target of a multi-target task", () => {
    const earlier = task({
      id: "t2",
      label: "TK-2",
      created_at: "2026-10-17T09:00:00.000Z",
      allocations: [
        { id: "a2", mission_id: "m2", target_id: "target-2", aiming_point_id: "ap-3", asset_id: "uav_2", quantity: 2 },
      ],
    });
    const later = task({
      id: "t3",
      label: "TK-3",
      created_at: "2026-10-18T09:00:00.000Z",
      allocations: [
        { id: "a1", mission_id: "m3", target_id: "target-1", aiming_point_id: "ap-1", asset_id: "uav_1", quantity: 7 },
        { id: "a1b", mission_id: "m3", target_id: "target-1", aiming_point_id: "ap-2", asset_id: "uav_1", quantity: 4 },
        { id: "a3", mission_id: "m3", target_id: "target-2", aiming_point_id: "ap-3", asset_id: "uav_1", quantity: 11 },
      ],
    });

    const cards = splitTasksByTarget(
      [later, earlier],
      [mission("m2", "MN-2", "Заграва"), mission("m3", "MN-3", "Килим")],
      [target("target-1", "Склад"), target("target-2", "Контрольний пункт")],
    );

    expect(cards.map((card) => card.label)).toEqual(["TK-2", "TK-3.1", "TK-3.2"]);
    expect(cards[1]?.title).toBe("Килим — Склад");
    expect(cards[2]?.title).toBe("Килим — Контрольний пункт");
    expect(cards[1]?.targetId).toBe("target-1");
  });
});
