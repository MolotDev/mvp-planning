import { beforeEach, describe, expect, it } from "vitest";
import { getEntityState, resolvePlanningEntityState } from "@/lib/entityState";
import { relatedLaunchIdsForMissionConfirmation, relatedTasksForMissionConfirmation } from "@/lib/missionConfirmation";
import { COMPLETED_CONFIRMED } from "@/types/target";
import { registerReportSource } from "@/store/storeBridge";
import { resetLaunchStore, useLaunchStore } from "@/store/useLaunchStore";
import { resetMissionStore, useMissionStore } from "@/store/useMissionStore";
import { resetTaskStore, useTaskStore } from "@/store/useTaskStore";
import type { Launch } from "@/types/launch";
import type { Mission, Task } from "@/types/mission";
import type { Report } from "@/types/report";

const NOW = "2026-10-20T12:00:00.000Z";

function mission(): Mission {
  return {
    id: "m1",
    label: "FM-1",
    name: "Test",
    description: "",
    scheduled_at: NOW,
    task_ids: ["t1"],
    created_at: NOW,
    updated_at: NOW,
    reported_at: NOW,
    confirmed_at: null,
    archived_at: null,
  };
}

function task(patch: Partial<Task> = {}): Task {
  return {
    id: "t1",
    label: "TK-1",
    organization_id: "detachment_1",
    mission_id: "m1",
    source: "center",
    scheduled_at: NOW,
    allocations: [
      {
        id: "a1",
        mission_id: "m1",
        target_id: "tg1",
        aiming_point_id: null,
        asset_id: "uav_1",
        quantity: 1,
      },
    ],
    battle_groups_ids: [],
    fact_submitted_at: null,
    fact_notes: null,
    created_at: NOW,
    updated_at: NOW,
    reported_at: NOW,
    confirmed_at: null,
    archived_at: null,
    ...patch,
  };
}

function launch(patch: Partial<Launch> = {}): Launch {
  return {
    id: "l1",
    task_id: "t1",
    battle_group_id: "g1",
    allocation_line_id: "a1",
    asset_id: "uav_1",
    asset_serial_number: "SN",
    tracker_model_id: null,
    tracker_model_serial_number: null,
    aiming_point_mgrs: "36U EV 11111 11111",
    trajectory_name: "T-1",
    ammo_model_id: "",
    ammo_quantity: 0,
    created_at: NOW,
    updated_at: NOW,
    archived_at: null,
    confirmed_at: null,
    reported_at: NOW,
    reported_at_time: "15:00",
    processed_at: NOW,
    launch_status_id: "done",
    cause_launch_problem_id: "",
    comments: "",
    actual_launch_time: null,
    execution_status: "success",
    bda_result: null,
    launch_order: 1,
    ...patch,
  };
}

function submittedReport(): Report {
  return {
    id: "r1",
    organization_id: "detachment_1",
    report_date: "2026-10-20",
    status: "submitted",
    archived_at: null,
    submitted_at: NOW,
    created_at: NOW,
    updated_at: NOW,
    analysis_timestamp: "",
    commander_summary: null,
    planning_participants: null,
    adjacent_units_participants: null,
    trajectories: [],
    launches_by_trajectory: [],
    checkpoint_updates: [],
    actual_events: [],
    images: [],
  } as Report;
}

describe("confirmMission cascade", () => {
  beforeEach(() => {
    resetMissionStore();
    resetTaskStore();
    resetLaunchStore();
    registerReportSource(() => []);
  });

  it("sets confirmed_at on related tasks and launches", () => {
    useMissionStore.setState({ missions: [mission()], missionSeq: 1 });
    useTaskStore.setState({ tasks: [task()], taskSeq: 1 });
    useLaunchStore.setState({ launches: [launch()] });
    registerReportSource(() => [submittedReport()]);

    const ok = useMissionStore.getState().confirmMission("m1");
    expect(ok).toBe(true);
    expect(getEntityState(useMissionStore.getState().missions[0])).toBe(COMPLETED_CONFIRMED);
    expect(getEntityState(useTaskStore.getState().tasks[0])).toBe(COMPLETED_CONFIRMED);
    expect(getEntityState(useLaunchStore.getState().launches[0])).toBe(COMPLETED_CONFIRMED);
  });

  it("includes same-day participant flight requests and allocation-linked launches", () => {
    const dayTask = task({
      id: "t2",
      label: "TK-2",
      mission_id: null,
      allocations: [
        {
          id: "a2",
          mission_id: "",
          target_id: "tg1",
          aiming_point_id: null,
          asset_id: "uav_1",
          quantity: 1,
        },
      ],
    });
    const linked = task();
    const orphanLaunch = launch({
      id: "l2",
      task_id: "t2",
      allocation_line_id: "a1",
    });
    const related = relatedTasksForMissionConfirmation(mission(), [linked, dayTask]);
    expect(related.map((item) => item.id).sort()).toEqual(["t1", "t2"]);
    const launchIds = relatedLaunchIdsForMissionConfirmation(mission(), [linked, dayTask], [launch(), orphanLaunch]);
    expect(launchIds.sort()).toEqual(["l1", "l2"]);
  });

  it("clears confirmed_at on unlock and restores reported badge chain", () => {
    useMissionStore.setState({
      missions: [{ ...mission(), confirmed_at: NOW }],
      missionSeq: 1,
    });
    useTaskStore.setState({
      tasks: [{ ...task(), confirmed_at: NOW }],
      taskSeq: 1,
    });
    useLaunchStore.setState({
      launches: [{ ...launch(), confirmed_at: NOW }],
    });
    registerReportSource(() => [submittedReport()]);

    const ok = useMissionStore.getState().unlockMissionReports("m1");
    expect(ok).toBe(true);
    expect(useMissionStore.getState().missions[0].confirmed_at).toBeNull();
    expect(useTaskStore.getState().tasks[0].confirmed_at).toBeNull();
    expect(useLaunchStore.getState().launches[0].confirmed_at).toBeNull();
    expect(getEntityState(useTaskStore.getState().tasks[0])).toBe("reported");
    expect(
      resolvePlanningEntityState(
        useTaskStore.getState().tasks[0],
        useMissionStore.getState().missions[0],
        useLaunchStore.getState().launches[0],
      ),
    ).toBe("reported");
  });
});
