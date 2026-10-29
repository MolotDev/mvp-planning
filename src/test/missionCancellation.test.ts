import { describe, expect, it } from "vitest";
import {
  applyLaunchCancellationPatches,
  applyTrackerCancellation,
  buildCancellationLaunchViews,
  handleMissionCancellation,
  isCompletedLaunchForCancellation,
  resolveCancellationOutcome,
} from "@/lib/missionCancellation";
import { createInitialTrackersPool } from "@/lib/trackerPool";
import type { Launch } from "@/types/launch";
import type { Report } from "@/types/report";

function launch(id: string, status: string, serial: string | null = null): Launch {
  return {
    id,
    task_id: "task-1",
    launch_order: 1,
    battle_group_id: "bg-1",
    allocation_line_id: null,
    asset_id: "uav_1",
    asset_serial_number: "SN",
    tracker_model_id: serial ? `trk_${serial}` : null,
    tracker_model_serial_number: serial,
    aiming_point_mgrs: "",
    trajectory_name: "1",
    ammo_model_id: "ammo_1",
    ammo_quantity: 1,
    created_at: "",
    updated_at: "",
    archived_at: null,
    confirmed_at: null,
    reported_at: null,
    reported_at_time: null,
    processed_at: null,
    launch_status_id: status,
    cause_launch_problem_id: "",
    comments: "",
    actual_launch_time: null,
    execution_status: null,
    bda_result: null,
  };
}

function report(events: Array<{ time: string }>): Report {
  return {
    id: "r1",
    organization_id: "detachment_1",
    report_date: "2026-10-28",
    analysis_timestamp: "2026-10-28T10:00:00.000Z",
    status: "draft",
    commander_summary: null,
    planning_participants: null,
    adjacent_units_participants: null,
    trajectories: [],
    launches_by_trajectory: [
      { launch_id: "l1", trajectory_id: "t1", launch_number: 1, launched_at: "2026-10-28T07:15:00.000Z" },
      { launch_id: "l2", trajectory_id: "t1", launch_number: 2, launched_at: "2026-10-28T00:01:00.000Z" },
    ],
    checkpoint_updates: [],
    actual_events: events.map((event, index) => ({
      id: `e${index}`,
      time: event.time,
      date: "2026-10-28",
      event_description: "prefix - 1.1.1 - Повернення",
      comment: "",
    })),
    images: [],
    created_at: "",
    updated_at: "",
    archived_at: null,
    submitted_at: null,
  };
}

describe("missionCancellation", () => {
  it("treats default 00:01 launches as incomplete", () => {
    expect(
      isCompletedLaunchForCancellation({
        id: "1",
        launch_status_id: "success",
        launch_time: "00:01",
        tracker_serial: "TRK-01",
      }),
    ).toBe(false);
    expect(
      isCompletedLaunchForCancellation({
        id: "1",
        launch_status_id: "success",
        launch_time: "07:15",
        tracker_serial: "TRK-01",
      }),
    ).toBe(true);
  });

  it("scenario 1 before exit returns trackers without submitting a report", () => {
    const trackers = createInitialTrackersPool().map((item, index) =>
      index === 0
        ? { ...item, status: "assigned" as const, assigned_launch_id: "l1", assigned_task_id: "task-1" }
        : item,
    );
    const result = handleMissionCancellation({
      report: report([]),
      launches: [launch("l1", "planned", "TRK-01")],
      links: [],
      trackers,
      cancelTime: "11:30",
      reason: "Наказ",
      role: "CENTER",
    });
    expect(result.outcome).toBe("cancelled_before_exit");
    expect(result.shouldSubmitReport).toBe(false);
    expect(result.releaseCrews).toBe(true);
    expect(result.trackers.find((item) => item.number === "TRK-01")?.status).toBe("available");
  });

  it("scenario 2 aborts all launches and returns trackers", () => {
    const views = buildCancellationLaunchViews(
      [launch("l1", "planned", "TRK-01"), launch("l2", "planned", "TRK-02")],
      [
        { launch_id: "l1", trajectory_id: "t", launch_number: 1, launched_at: "2026-10-28T00:01:00.000Z" },
        { launch_id: "l2", trajectory_id: "t", launch_number: 2, launched_at: "2026-10-28T00:01:00.000Z" },
      ],
    );
    expect(resolveCancellationOutcome(true, views)).toBe("cancelled_without_launches");
    const patches = applyLaunchCancellationPatches(views, "12:00");
    expect(patches.every((item) => item.status === "abort" && item.launch_time === "12:00")).toBe(true);
    const trackers = createInitialTrackersPool().map((item) =>
      item.number === "TRK-01" || item.number === "TRK-02"
        ? { ...item, status: "assigned" as const, assigned_launch_id: item.number === "TRK-01" ? "l1" : "l2" }
        : item,
    );
    const next = applyTrackerCancellation(trackers, views, patches, "cancelled_without_launches");
    expect(next.find((item) => item.number === "TRK-01")?.status).toBe("available");
    expect(next.find((item) => item.number === "TRK-02")?.status).toBe("available");
    expect(next.find((item) => item.number === "TRK-01")?.assigned_launch_id).toBeNull();
    expect(next.find((item) => item.number === "TRK-02")?.assigned_launch_id).toBeNull();
  });

  it("scenario 2 releases trackers assigned by launch id when serial on launch is empty", () => {
    const views = buildCancellationLaunchViews(
      [launch("l1", "planned", null)],
      [{ launch_id: "l1", trajectory_id: "t", launch_number: 1, launched_at: "2026-10-28T00:01:00.000Z" }],
    );
    const patches = applyLaunchCancellationPatches(views, "12:00");
    const trackers = createInitialTrackersPool().map((item) =>
      item.number === "TRK-03"
        ? { ...item, status: "assigned" as const, assigned_launch_id: "l1", assigned_task_id: "task-1" }
        : item,
    );
    const next = applyTrackerCancellation(trackers, views, patches, "cancelled_without_launches");
    expect(next.find((item) => item.number === "TRK-03")).toMatchObject({
      status: "available",
      assigned_launch_id: null,
      assigned_task_id: null,
    });
  });

  it("scenario 3 expends completed trackers and frees aborted ones", () => {
    const views = buildCancellationLaunchViews(
      [launch("l1", "success", "TRK-01"), launch("l2", "planned", "TRK-02")],
      [
        { launch_id: "l1", trajectory_id: "t", launch_number: 1, launched_at: "2026-10-28T07:15:00.000Z" },
        { launch_id: "l2", trajectory_id: "t", launch_number: 2, launched_at: "2026-10-28T00:01:00.000Z" },
      ],
    );
    expect(resolveCancellationOutcome(true, views)).toBe("partially_completed");
    const patches = applyLaunchCancellationPatches(views, "13:40");
    expect(patches.find((item) => item.id === "l1")?.status).toBe("keep");
    expect(patches.find((item) => item.id === "l2")).toMatchObject({ status: "abort", launch_time: "13:40" });
    const trackers = createInitialTrackersPool().map((item) =>
      item.number === "TRK-01" || item.number === "TRK-02"
        ? { ...item, status: "assigned" as const, assigned_launch_id: item.number === "TRK-01" ? "l1" : "l2" }
        : item,
    );
    const next = applyTrackerCancellation(trackers, views, patches, "partially_completed");
    expect(next.find((item) => item.number === "TRK-01")?.status).toBe("expended");
    expect(next.find((item) => item.number === "TRK-02")?.status).toBe("available");
  });
});
