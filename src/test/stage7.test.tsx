import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import { DICTIONARY } from "@/constants/dictionary";
import { BATTLE_GROUP_1_ID, MISSION_1_ID, TASK_1_ID, TASK_2_ID } from "@/data/missionSeed";
import { AP_3_ID, TARGET_1_ID, TARGET_2_ID } from "@/data/targetSeed";
import { aggregateDay, dayTargetRoles, deriveReportMetrics, matchingReports } from "@/lib/reportAggregation";
import { toReportDate } from "@/lib/reportFormat";
import { isReportSubmittable } from "@/lib/reportValidation";
import { syncReportForTask } from "@/store/storeBridge";
import { resetBattleGroupStore, useBattleGroupStore } from "@/store/useBattleGroupStore";
import { resetLaunchStore, useLaunchStore } from "@/store/useLaunchStore";
import { signInAs } from "@/test/auth";
import { useLayoutStore } from "@/store/useLayoutStore";
import { resetMissionStore, useMissionStore } from "@/store/useMissionStore";
import { resetReportFilterStore } from "@/store/useReportFilterStore";
import { reconcileAllocatedReports, resetReportStore, useReportStore } from "@/store/useReportStore";
import { resetTaskStore, useTaskStore } from "@/store/useTaskStore";
import { resetTargetStore, useTargetStore } from "@/store/useTargetStore";
import type { Report } from "@/types/report";

function renderApp(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
      <Toaster />
    </MemoryRouter>,
  );
}

function cardFor(label: string): HTMLElement {
  const card = screen.getByText(label).closest("div.rounded-lg");
  if (!card) {
    throw new Error(`Card for ${label} was not found`);
  }
  return card as HTMLElement;
}

function planningSnapshot() {
  return {
    missions: useMissionStore.getState().missions,
    tasks: useTaskStore.getState().tasks,
    targets: [],
    battleGroups: useBattleGroupStore.getState().battleGroups,
    launches: useLaunchStore.getState().launches,
  };
}

function completeReport(report: Report, taskId: string) {
  useLaunchStore.getState().launches.forEach((launch) => {
    if (launch.task_id === taskId && launch.archived_at === null) {
      useLaunchStore.getState().updateLaunch(launch.id, { trajectory_name: "Маршрут 1" });
    }
  });
  useReportStore.getState().syncDraftLinks(report.id);
  const synced = useReportStore.getState().reports.find((item) => item.id === report.id) ?? report;
  const trajectory = synced.trajectories[0];
  const group = useBattleGroupStore.getState().battleGroups.find((item) => item.task_id === taskId);
  if (!trajectory || !group) {
    throw new Error("Report baseline is missing");
  }
  useReportStore.getState().updateTrajectory(report.id, trajectory.id, {
    name: "Маршрут 1",
    battle_group_id: group.id,
    asset_id: group.asset_id,
    distance: 1246,
    trajectory_height: "346 - 421",
    height_above_hot_point: "50 - 70",
    hot_point_cross_line: "північний рубіж",
    duration: "11 год 52 хв",
    time_on_target: new Date().toISOString(),
  });
  return useReportStore.getState().reports.find((item) => item.id === report.id) as Report;
}

beforeEach(() => {
  signInAs();
  toast.dismiss();
  resetTargetStore();
  resetBattleGroupStore();
  resetLaunchStore();
  resetTaskStore();
  resetMissionStore();
  resetReportStore();
  resetReportFilterStore();
  useLayoutStore.setState({ isSidebarOpen: true });
});

afterEach(() => {
  resetTargetStore();
  resetBattleGroupStore();
  resetLaunchStore();
  resetTaskStore();
  resetMissionStore();
  resetReportStore();
  resetReportFilterStore();
});

describe("Stage 7 daily detachment reports", () => {
  it("creates one draft per detachment and date when battle groups are allocated", () => {
    syncReportForTask(TASK_1_ID);
    syncReportForTask(TASK_1_ID);
    syncReportForTask(TASK_2_ID);

    const reports = useReportStore.getState().reports;
    const mission = useMissionStore.getState().missions.find((item) => item.id === MISSION_1_ID);
    const reportDate = toReportDate(mission!.scheduled_at);
    expect(reports.filter((report) => report.organization_id === "detachment_1" && report.report_date === reportDate)).toHaveLength(1);
    expect(reports.filter((report) => report.organization_id === "detachment_2" && report.report_date === reportDate)).toHaveLength(1);
    expect(reports.every((report) => report.status === "draft")).toBe(true);
    expect(useReportStore.getState().reports.find((report) => report.organization_id === "detachment_1")?.launches_by_trajectory).toHaveLength(4);
  });

  it("redirects manual creation to the existing report instead of duplicating it", () => {
    reconcileAllocatedReports();
    const mission = useMissionStore.getState().missions.find((item) => item.id === MISSION_1_ID);
    const reportDate = toReportDate(mission!.scheduled_at);
    const result = useReportStore.getState().createManual("detachment_1", reportDate);
    expect(result?.created).toBe(false);
    expect(
      useReportStore.getState().reports.filter((report) => report.organization_id === "detachment_1" && report.archived_at === null),
    ).toHaveLength(1);
  });

  it("locks only the reported detachment until every detachment report is submitted", () => {
    reconcileAllocatedReports();
    const first = useReportStore.getState().reports.find((report) => report.organization_id === "detachment_1");
    const second = useReportStore.getState().reports.find((report) => report.organization_id === "detachment_2");
    const completed = completeReport(first!, TASK_1_ID);
    expect(isReportSubmittable(completed, planningSnapshot())).toBe(true);
    expect(useReportStore.getState().submitReport(completed.id)).toBe(true);

    const taskOne = useTaskStore.getState().tasks.find((task) => task.id === TASK_1_ID);
    const taskTwo = useTaskStore.getState().tasks.find((task) => task.id === TASK_2_ID);
    const mission = useMissionStore.getState().missions.find((item) => item.id === MISSION_1_ID);
    expect(taskOne?.reported_at).not.toBeNull();
    expect(taskTwo?.reported_at).toBeNull();
    expect(mission?.reported_at).toBeNull();
    expect(
      useLaunchStore.getState().launches.filter((launch) => launch.task_id === TASK_1_ID && launch.reported_at !== null),
    ).toHaveLength(4);
    expect(
      useLaunchStore.getState().launches.filter((launch) => launch.task_id === TASK_2_ID && launch.reported_at === null),
    ).toHaveLength(2);
    expect(useReportStore.getState().reports.find((report) => report.id === completed.id)?.status).toBe("submitted");

    const completedSecond = completeReport(second!, TASK_2_ID);
    expect(useReportStore.getState().submitReport(completedSecond.id)).toBe(true);
    expect(useMissionStore.getState().missions.find((item) => item.id === MISSION_1_ID)?.reported_at).not.toBeNull();
  });

  it("shows the view report action only for a matching detachment day", async () => {
    reconcileAllocatedReports();
    renderApp("/planning/tasks");
    const firstCard = cardFor("TK-1");
    expect(
      await within(firstCard).findByRole("button", { name: new RegExp(DICTIONARY.common.actions.view_report) }),
    ).toBeInTheDocument();
    expect(
      within(cardFor("TK-2")).getByRole("button", { name: new RegExp(DICTIONARY.common.actions.view_report) }),
    ).toBeInTheDocument();
  });

  it("edits launch serials from the report and clears the tracker", async () => {
    reconcileAllocatedReports();
    const report = useReportStore.getState().reports.find((item) => item.organization_id === "detachment_1");
    const user = userEvent.setup();
    signInAs("DETACHMENT", "detachment_1");
    renderApp(`/reports/${report!.id}?mode=edit`);

    const serials = await screen.findAllByLabelText(DICTIONARY.reports.tables.launches_grouped.asset_sn);
    await user.type(serials[0], "SN-9");
    expect(
      useLaunchStore.getState().launches.find((launch) => launch.battle_group_id === BATTLE_GROUP_1_ID)?.asset_serial_number,
    ).toContain("SN-9");

    const trackers = screen.getAllByLabelText(DICTIONARY.reports.tables.launches_grouped.tracker_sn);
    await user.type(trackers[0], "TR-1");
    await user.clear(trackers[0]);
    const launch = useLaunchStore
      .getState()
      .launches.filter((item) => item.battle_group_id === BATTLE_GROUP_1_ID)
      .sort((left, right) => left.created_at.localeCompare(right.created_at))[0];
    expect(launch.tracker_model_id).toBeNull();
    expect(launch.tracker_model_serial_number).toBeNull();
    expect(await screen.findByText(DICTIONARY.reports.toasts.tracker_cleared)).toBeInTheDocument();
  });

  it("pools every mission task and target of the detachment into one daily report", () => {
    reconcileAllocatedReports();
    const mission = useMissionStore.getState().missions.find((item) => item.id === MISSION_1_ID);
    const created = useMissionStore.getState().createMission(
      {
        name: "Друга доба",
        scheduled_at: mission!.scheduled_at,
        description: "Додаткова ціль того самого дня",
      },
      [
        {
          target_ids: [TARGET_2_ID],
          aiming_point_id: AP_3_ID,
          organization_id: "detachment_1",
          asset_id: "uav_1",
          quantity: 1,
          battle_groups_ids: [],
        },
      ],
    );
    const extraTask = useTaskStore.getState().tasks.find((task) => task.mission_id === created.id);
    expect(extraTask).toBeTruthy();
    expect(
      useBattleGroupStore.getState().createBattleGroup({
        task_id: extraTask!.id,
        lead_crew_id: "1.1.3",
        support_crew_ids: [],
        asset_id: "uav_1",
        uav_quantity: 1,
      }),
    ).not.toBeNull();

    const reportDate = toReportDate(mission!.scheduled_at);
    const reports = useReportStore
      .getState()
      .reports.filter(
        (report) =>
          report.organization_id === "detachment_1" &&
          report.report_date === reportDate &&
          report.archived_at === null,
      );
    expect(reports).toHaveLength(1);
    expect(matchingReports(reports, ["detachment_1"], mission!.scheduled_at).map((report) => report.id)).toEqual([
      reports[0].id,
    ]);
    expect(matchingReports(useReportStore.getState().reports, [extraTask!.organization_id], created.scheduled_at)[0].id).toBe(
      reports[0].id,
    );

    const snapshot = {
      missions: useMissionStore.getState().missions,
      tasks: useTaskStore.getState().tasks,
      targets: [...useTargetStore.getState().targets].reverse(),
      battleGroups: useBattleGroupStore.getState().battleGroups,
      launches: useLaunchStore.getState().launches,
    };
    const slice = aggregateDay("detachment_1", reportDate, snapshot);
    expect(slice.missions).toHaveLength(2);
    expect(slice.tasks.map((task) => task.id)).toEqual([TASK_1_ID, extraTask!.id]);
    expect(dayTargetRoles(slice).primary?.id).toBe(TARGET_1_ID);
    expect(dayTargetRoles(slice).additional.map((target) => target.id)).toEqual([TARGET_2_ID]);
    expect(slice.launches.filter((launch) => launch.task_id === extraTask!.id)).toHaveLength(1);
    const metrics = deriveReportMetrics(slice);
    expect(metrics.total_missions_count).toBe(2);
    expect(metrics.total_tasks_count).toBe(2);
    expect(metrics.total_launches_count).toBe(slice.launches.length);
    expect(metrics.success_rate).toBe(0);
  });
});
