import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import { DICTIONARY } from "@/constants/dictionary";
import { BATTLE_GROUP_1_ID, MISSION_1_ID, TASK_1_ID, TASK_2_ID } from "@/data/missionSeed";
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
import { resetTargetStore } from "@/store/useTargetStore";
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
    expect(await within(firstCard).findByRole("button", { name: DICTIONARY.common.actions.view_report })).toBeInTheDocument();
    expect(within(cardFor("TK-2")).getByRole("button", { name: DICTIONARY.common.actions.view_report })).toBeInTheDocument();
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
});
