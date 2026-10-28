import { describe, expect, it } from "vitest";
import { classifyCrewReadiness, detachmentTone, linePrepState, prepSegmentsForLine, prepTone } from "@/lib/missionDashboard";
import type { Launch } from "@/types/launch";

describe("mission readiness tones", () => {
  it("marks a full kit ready, a partial kit in progress, and an empty kit idle", () => {
    expect(prepTone(3, 3)).toBe("ready");
    expect(prepTone(2, 5)).toBe("progress");
    expect(prepTone(0, 7)).toBe("idle");
  });

  it("asks for allocation before it calls a detachment ready", () => {
    expect(detachmentTone(4, 4, 13)).toBe("needs_allocation");
    expect(detachmentTone(8, 8, 8)).toBe("ready");
    expect(detachmentTone(8, 4, 8)).toBe("progress");
  });

  it("splits crews into ready, in progress, and not started", () => {
    const result = classifyCrewReadiness([
      { crewId: "a", assigned: 2, prepped: 2 },
      { crewId: "b", assigned: 4, prepped: 1 },
      { crewId: "c", assigned: 3, prepped: 0 },
    ]);
    expect(result.readyCrews).toBe(1);
    expect(result.readyBoards).toBe(2);
    expect(result.progressCrews).toBe(1);
    expect(result.progressPrepped).toBe(1);
    expect(result.idleCrews).toBe(1);
    expect(result.idleAssigned).toBe(3);
  });

  it("separates a fully prepped line, a partial line, a queued line, and a line without a crew", () => {
    expect(linePrepState(4, 4, 4)).toBe("ready");
    expect(linePrepState(1, 4, 4)).toBe("progress");
    expect(linePrepState(0, 4, 4)).toBe("queued");
    expect(linePrepState(0, 0, 4)).toBe("needs_crew");
  });

  it("splits planned quantity into prepped, partial, untouched, and unallocated units", () => {
    const launches = [
      launch({ id: "ready", asset_serial_number: "SN-1", trajectory_name: "1" }),
      launch({ id: "partial", asset_serial_number: "SN-2", trajectory_name: null }),
      launch({ id: "empty", asset_serial_number: "", trajectory_name: null }),
    ];
    expect(prepSegmentsForLine(4, 3, launches)).toEqual({
      prepped: 1,
      partial: 1,
      untouched: 1,
      unallocated: 1,
    });
  });
});

function launch(patch: Partial<Launch> & Pick<Launch, "id">): Launch {
  return {
    task_id: "task",
    battle_group_id: "group",
    allocation_line_id: "line",
    asset_id: "uav_1",
    asset_serial_number: "",
    tracker_model_id: null,
    tracker_model_serial_number: null,
    aiming_point_mgrs: "36U EV 11111 11111",
    trajectory_name: null,
    ammo_model_id: "",
    ammo_quantity: 0,
    created_at: "2026-10-18T00:00:00.000Z",
    updated_at: "2026-10-18T00:00:00.000Z",
    archived_at: null,
    confirmed_at: null,
    reported_at: null,
    reported_at_time: null,
    processed_at: null,
    launch_status_id: "planned",
    cause_launch_problem_id: "",
    comments: "",
    actual_launch_time: null,
    execution_status: "pending",
    bda_result: null,
    ...patch,
    launch_order: patch.launch_order ?? 1,
  };
}
