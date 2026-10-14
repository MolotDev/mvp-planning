import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import { DICTIONARY } from "@/constants/dictionary";
import { LAUNCH_BG1_IDS, LAUNCH_BG2_IDS } from "@/data/launchSeed";
import { BATTLE_GROUP_1_ID, BATTLE_GROUP_2_ID, MISSION_1_ID, TASK_1_ID, TASK_2_ID } from "@/data/missionSeed";
import { signInAs } from "@/test/auth";
import { useLayoutStore } from "@/store/useLayoutStore";
import { resetBattleGroupStore } from "@/store/useBattleGroupStore";
import { resetLaunchFilterStore } from "@/store/useLaunchFilterStore";
import { resetLaunchStore, useLaunchStore } from "@/store/useLaunchStore";
import { resetMissionStore, useMissionStore } from "@/store/useMissionStore";
import { resetTaskFilterStore } from "@/store/useTaskFilterStore";
import { resetTaskStore, useTaskStore } from "@/store/useTaskStore";
import { resetTargetStore } from "@/store/useTargetStore";

const board = DICTIONARY.tasks.launch_board;
const unassigned = DICTIONARY.tasks.aiming_point_unassigned;

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

beforeEach(() => {
  signInAs();
  toast.dismiss();
  resetTargetStore();
  resetBattleGroupStore();
  resetLaunchStore();
  resetTaskStore();
  resetMissionStore();
  resetTaskFilterStore();
  resetLaunchFilterStore();
  useLayoutStore.setState({ isSidebarOpen: true });
});

afterEach(() => {
  resetTargetStore();
  resetBattleGroupStore();
  resetLaunchStore();
  resetTaskStore();
  resetMissionStore();
  resetTaskFilterStore();
  resetLaunchFilterStore();
});

describe("Stage 5 aiming point assignment", () => {
  it("highlights unassigned aiming points and leaves a single assigned point clear", () => {
    renderApp(`/planning/tasks/${TASK_1_ID}`);
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.getAllByText(unassigned)).toHaveLength(2);

    cleanup();
    renderApp(`/planning/tasks/${TASK_2_ID}`);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getAllByText("MP01").length).toBeGreaterThan(0);
  });

  it("shows the warning on the tasks board and mission preview only for uncovered points", () => {
    renderApp("/planning/tasks");
    expect(within(cardFor("TK-1")).getAllByText(unassigned)).toHaveLength(2);
    expect(within(cardFor("TK-2")).queryByText(unassigned)).not.toBeInTheDocument();

    cleanup();
    renderApp(`/planning/missions/${MISSION_1_ID}`);
    expect(screen.getAllByText(unassigned)).toHaveLength(2);
  });
});

describe("Stage 5 launches board", () => {
  it("filters launches by target id and switches to the ungrouped table", async () => {
    const user = userEvent.setup();
    renderApp("/planning/launches");
    expect(screen.getByText("Всього пусків: 4 * AT-01")).toBeInTheDocument();
    expect(screen.getByText("Всього пусків: 2 * AT-02")).toBeInTheDocument();
    expect(screen.queryByText("Опрацьованих пусків: 2 * AT-02")).not.toBeInTheDocument();
    expect(screen.getAllByText("Опрацьованих пусків: 0").length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText(DICTIONARY.common.actions.search), "GS2088");
    expect(screen.queryByText("Всього пусків: 4 * AT-01")).not.toBeInTheDocument();
    expect(screen.getByText("Всього пусків: 2 * AT-02")).toBeInTheDocument();

    await user.clear(screen.getByLabelText(DICTIONARY.common.actions.search));
    await user.selectOptions(screen.getByLabelText(board.group_mode), "table");
    expect(screen.getByRole("columnheader", { name: board.columns.date })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: board.columns.aiming_mgrs })).toBeInTheDocument();
    expect(screen.getAllByRole("row").length).toBe(7);

    await user.click(screen.getAllByRole("button", { name: DICTIONARY.common.actions.edit })[0]);
    expect(screen.getByRole("button", { name: DICTIONARY.common.actions.save })).toBeInTheDocument();
    expect(screen.getByLabelText(`${board.columns.aiming_mgrs} ${LAUNCH_BG1_IDS[0]}`)).toBeInTheDocument();
    expect(screen.getByLabelText(`${board.columns.ammo_quantity} ${LAUNCH_BG1_IDS[0]}`)).toHaveValue(1);
    await user.type(screen.getByLabelText(`${board.columns.uav_serial} ${LAUNCH_BG1_IDS[0]}`), "UAV-77");
    await user.type(screen.getByLabelText(`${board.columns.tracker_serial} ${LAUNCH_BG1_IDS[0]}`), "TR-9");
    expect(useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0])?.asset_serial_number).toBe(
      "",
    );

    await user.click(screen.getByRole("button", { name: DICTIONARY.common.actions.save }));
    const launch = useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0]);
    expect(launch?.asset_serial_number).toBe("UAV-77");
    expect(launch?.tracker_model_serial_number).toBe("TR-9");
    expect(launch?.tracker_model_id).toBe("tracker_1");
    expect(launch?.ammo_quantity).toBe(1);
    expect(screen.queryByRole("button", { name: DICTIONARY.common.actions.save })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: board.cancel_changes })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: DICTIONARY.common.actions.edit }).length).toBeGreaterThan(0);
  });

  it("cancels a table edit without saving the draft", async () => {
    const user = userEvent.setup();
    act(() => {
      useLaunchStore.getState().updateLaunch(LAUNCH_BG1_IDS[0], { aiming_point_mgrs: "36U EV 45220 88325" });
    });
    renderApp("/planning/launches");
    await user.selectOptions(screen.getByLabelText(board.group_mode), "table");
    await user.click(screen.getAllByRole("button", { name: DICTIONARY.common.actions.edit })[0]);
    expect(screen.getByRole("button", { name: board.cancel_changes })).toBeInTheDocument();

    expect(screen.getByLabelText(`${board.columns.aiming_mgrs} ${LAUNCH_BG1_IDS[0]}`)).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(`${board.columns.ammo} ${LAUNCH_BG1_IDS[0]}`), "ammo_1");
    await user.type(
      screen.getByLabelText(`${DICTIONARY.launches.fields.trajectory_name} ${LAUNCH_BG1_IDS[0]}`),
      "М-01",
    );
    await user.type(screen.getByLabelText(`${board.columns.uav_serial} ${LAUNCH_BG1_IDS[0]}`), "UAV-7");
    expect(useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0])?.processed_at).toEqual(
      expect.any(String),
    );

    await user.click(screen.getByRole("button", { name: board.cancel_changes }));
    const launch = useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0]);
    expect(launch?.processed_at).toBeNull();
    expect(launch?.aiming_point_mgrs).toBe("36U EV 45220 88325");
    expect(launch?.ammo_model_id).toBe("");
    expect(launch?.asset_serial_number).toBe("");
    expect(screen.queryByRole("button", { name: DICTIONARY.common.actions.save })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: board.cancel_changes })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: DICTIONARY.common.actions.edit }).length).toBeGreaterThan(0);
    expect(screen.getByText("Пуски: 0 / 6 опрацьовано")).toBeInTheDocument();
  });

  it("applies one ammo model to every launch in the modal and assigns an aiming point", async () => {
    const user = userEvent.setup();
    renderApp("/planning/launches");
    await user.click(screen.getAllByRole("button", { name: DICTIONARY.common.actions.preview })[0]);
    await user.click(screen.getByRole("switch", { name: board.edit_launches }));
    expect(screen.getByRole("button", { name: board.reset_to_base })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: DICTIONARY.common.actions.save })).toBeDisabled();

    expect(screen.getByLabelText(`${board.columns.aiming_mgrs} ${LAUNCH_BG1_IDS[0]}`)).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(`${board.columns.ammo} ${LAUNCH_BG1_IDS[0]}`), "ammo_2");
    await user.click(screen.getByRole("button", { name: board.apply_ammo_all }));
    expect(screen.getByRole("button", { name: DICTIONARY.common.actions.save })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: board.reset_to_base }));
    expect(screen.getByLabelText(`${board.columns.ammo} ${LAUNCH_BG1_IDS[0]}`)).toHaveValue("");
    expect(screen.queryByRole("button", { name: board.apply_ammo_all })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: DICTIONARY.common.actions.save })).toBeDisabled();

    expect(screen.getByLabelText(`${board.columns.aiming_mgrs} ${LAUNCH_BG1_IDS[0]}`)).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(`${board.columns.ammo} ${LAUNCH_BG1_IDS[0]}`), "ammo_2");
    await user.click(screen.getByRole("button", { name: board.apply_ammo_all }));
    await user.click(screen.getByRole("button", { name: DICTIONARY.common.actions.save }));
    expect(await screen.findByText(board.saved)).toBeInTheDocument();

    const launches = useLaunchStore.getState().launches;
    const bg1 = launches.filter((launch) => launch.battle_group_id === BATTLE_GROUP_1_ID && launch.archived_at === null);
    const bg2 = launches.filter((launch) => launch.battle_group_id === BATTLE_GROUP_2_ID && launch.archived_at === null);
    expect(bg1).toHaveLength(4);
    expect(bg1.every((launch) => launch.ammo_model_id === "ammo_2")).toBe(true);
    expect(launches.find((launch) => launch.id === LAUNCH_BG1_IDS[0])?.aiming_point_mgrs).toBe("");
    expect(
      LAUNCH_BG1_IDS.slice(1).every(
        (id) => launches.find((launch) => launch.id === id)?.aiming_point_mgrs === "",
      ),
    ).toBe(true);
    expect(bg2.every((launch) => launch.ammo_model_id === "" && launch.aiming_point_mgrs === "36U EV 12900 44110")).toBe(
      true,
    );
  });

  it("sets processed_at when the fourth required field is filled and clears it when one is removed", async () => {
    const user = userEvent.setup();
    renderApp("/planning/launches");
    expect(screen.getByText("Пуски: 0 / 6 опрацьовано")).toBeInTheDocument();
    act(() => {
      useLaunchStore.getState().updateLaunch(LAUNCH_BG1_IDS[0], { aiming_point_mgrs: "36U EV 45220 88325" });
    });

    await user.selectOptions(screen.getByLabelText(board.group_mode), "table");
    await user.click(screen.getAllByRole("button", { name: DICTIONARY.common.actions.edit })[0]);
    expect(screen.getByLabelText(`${board.columns.aiming_mgrs} ${LAUNCH_BG1_IDS[0]}`)).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(`${board.columns.ammo} ${LAUNCH_BG1_IDS[0]}`), "ammo_1");
    await user.type(
      screen.getByLabelText(`${DICTIONARY.launches.fields.trajectory_name} ${LAUNCH_BG1_IDS[0]}`),
      "М-01",
    );
    expect(useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0])?.processed_at).toBeNull();

    await user.type(screen.getByLabelText(`${board.columns.uav_serial} ${LAUNCH_BG1_IDS[0]}`), "UAV-7");
    const processed = useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0]);
    expect(processed?.processed_at).toEqual(expect.any(String));
    expect(processed?.asset_serial_number).toBe("UAV-7");
    expect(processed?.ammo_quantity).toBe(1);
    expect(screen.getByText("Пуски: 1 / 6 опрацьовано")).toBeInTheDocument();
    const stamp = processed?.processed_at;

    await user.type(screen.getByLabelText(`${board.columns.uav_serial} ${LAUNCH_BG1_IDS[0]}`), "7");
    expect(useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0])?.processed_at).toBe(stamp);
    expect(useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0])?.asset_serial_number).toBe(
      "UAV-77",
    );

    await user.clear(screen.getByLabelText(`${board.columns.uav_serial} ${LAUNCH_BG1_IDS[0]}`));
    expect(useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0])?.processed_at).toBeNull();
    expect(screen.getByText("Пуски: 0 / 6 опрацьовано")).toBeInTheDocument();
  });

  it("shows the processed counter on mission and task headers", () => {
    renderApp(`/planning/missions/${MISSION_1_ID}`);
    expect(screen.getByText("Пуски: 0 / 6 опрацьовано")).toBeInTheDocument();

    cleanup();
    renderApp(`/planning/tasks/${TASK_1_ID}`);
    expect(screen.getAllByText("Пуски: 0 / 4 опрацьовано").length).toBeGreaterThan(0);

    act(() => {
      useLaunchStore.getState().updateLaunch(LAUNCH_BG1_IDS[0], {
        aiming_point_mgrs: "36U EV 45220 88325",
        trajectory_name: "М-01",
        asset_serial_number: "UAV-1",
        ammo_model_id: "ammo_1",
        ammo_quantity: 1,
      });
    });
    expect(screen.getAllByText("Пуски: 1 / 4 опрацьовано").length).toBeGreaterThan(0);
    const stamp = useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0])?.processed_at;
    act(() => {
      useLaunchStore.getState().updateLaunch(LAUNCH_BG1_IDS[0], { ammo_quantity: 2 });
    });
    expect(useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0])?.processed_at).toBe(stamp);
    act(() => {
      useLaunchStore.getState().updateLaunch(LAUNCH_BG1_IDS[0], { ammo_model_id: "" });
    });
    expect(useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0])?.processed_at).toBeNull();
    expect(screen.getAllByText("Пуски: 0 / 4 опрацьовано").length).toBeGreaterThan(0);
  });

  it("shows the empty state when nothing matches", async () => {
    const user = userEvent.setup();
    renderApp("/planning/launches");
    await user.type(screen.getByLabelText(DICTIONARY.common.actions.search), "немає-такого");
    expect(screen.getByText(DICTIONARY.launches.empty)).toBeInTheDocument();
  });

  it("locks a reported launch in the table and keeps the other rows editable", async () => {
    const user = userEvent.setup();
    useLaunchStore.getState().reportLaunch(LAUNCH_BG1_IDS[0], {
      asset_serial_number: "UAV-1",
      tracker_model_id: "tracker_1",
      tracker_model_serial_number: "TR-1",
      aiming_point_mgrs: "36U EV 45210 88320",
      ammo_model_id: "ammo_1",
      ammo_quantity: 1,
      launch_status_id: "success",
      cause_launch_problem_id: "",
      comments: "",
    });
    renderApp("/planning/launches");
    await user.selectOptions(screen.getByLabelText(board.group_mode), "table");

    expect(screen.getAllByRole("button", { name: DICTIONARY.common.actions.edit })).toHaveLength(5);
    expect(screen.getAllByText(DICTIONARY.launches.labels.reported_status)).toHaveLength(1);
    expect(screen.queryByLabelText(`${board.columns.uav_serial} ${LAUNCH_BG1_IDS[0]}`)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: DICTIONARY.common.actions.delete }).length).toBeGreaterThan(0);
    expect(useLaunchStore.getState().updateLaunch(LAUNCH_BG1_IDS[0], { ammo_quantity: 3 })).toBeNull();
  });

  it("locks every launch when the parent mission is reported and opens the modal read-only", async () => {
    const user = userEvent.setup();
    useMissionStore.setState((state) => ({
      missions: state.missions.map((mission) =>
        mission.id === MISSION_1_ID ? { ...mission, reported_at: new Date().toISOString() } : mission,
      ),
    }));
    renderApp("/planning/launches");
    await user.selectOptions(screen.getByLabelText(board.group_mode), "table");

    expect(screen.queryAllByRole("button", { name: DICTIONARY.common.actions.edit })).toHaveLength(0);
    expect(screen.getAllByText(DICTIONARY.launches.labels.reported_status)).toHaveLength(6);
    expect(useLaunchStore.getState().updateLaunch(LAUNCH_BG1_IDS[1], { asset_serial_number: "UAV-X" })).toBeNull();

    cleanup();
    resetLaunchFilterStore();
    renderApp("/planning/launches");
    await user.click(screen.getAllByRole("button", { name: DICTIONARY.common.actions.preview })[0]);
    expect(screen.getByText(DICTIONARY.launches.labels.read_only_locked)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: board.edit_launches })).toBeDisabled();
    expect(screen.queryByRole("button", { name: DICTIONARY.common.actions.save })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: board.reset_to_base })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: board.apply_ammo_all })).not.toBeInTheDocument();
    expect(screen.getByLabelText(`${board.columns.aiming_mgrs} ${LAUNCH_BG1_IDS[0]}`)).toBeDisabled();
    expect(screen.getByLabelText(`${board.columns.uav_serial} ${LAUNCH_BG1_IDS[0]}`)).toBeDisabled();
    expect(screen.getByLabelText(`${board.columns.tracker_serial} ${LAUNCH_BG1_IDS[0]}`)).toBeDisabled();
    expect(screen.getByLabelText(`${board.columns.ammo} ${LAUNCH_BG1_IDS[0]}`)).toBeDisabled();
    expect(screen.getByLabelText(`${board.columns.ammo_quantity} ${LAUNCH_BG1_IDS[0]}`)).toBeDisabled();
  });

  it("locks launches of an archived task and leaves the other task editable", async () => {
    const user = userEvent.setup();
    useTaskStore.setState((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === TASK_1_ID ? { ...task, archived_at: new Date().toISOString() } : task,
      ),
    }));
    renderApp("/planning/launches");
    await user.selectOptions(screen.getByLabelText(board.group_mode), "table");

    expect(screen.getAllByText(DICTIONARY.launches.labels.archived_status)).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: DICTIONARY.common.actions.edit })).toHaveLength(2);
    expect(useLaunchStore.getState().updateLaunch(LAUNCH_BG1_IDS[0], { ammo_quantity: 2 })).toBeNull();
    expect(useLaunchStore.getState().updateLaunch(LAUNCH_BG2_IDS[0], { asset_serial_number: "UAV-2" })?.asset_serial_number).toBe(
      "UAV-2",
    );
  });

  it("clears both tracker fields from the hover action without deleting the launch", async () => {
    const user = userEvent.setup();
    renderApp("/planning/launches");
    await user.selectOptions(screen.getByLabelText(board.group_mode), "table");
    await user.click(screen.getAllByRole("button", { name: DICTIONARY.common.actions.edit })[0]);
    await user.type(screen.getByLabelText(`${board.columns.tracker_serial} ${LAUNCH_BG1_IDS[0]}`), "TR-9");
    await user.click(screen.getByRole("button", { name: DICTIONARY.common.actions.save }));

    const before = useLaunchStore.getState().launches.length;
    await user.click(screen.getAllByRole("button", { name: DICTIONARY.launches.tracker.delete_tooltip })[0]);
    expect(await screen.findByText(DICTIONARY.launches.toasts.tracker_cleared)).toBeInTheDocument();
    const launch = useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0]);
    expect(launch?.tracker_model_id).toBeNull();
    expect(launch?.tracker_model_serial_number).toBeNull();
    expect(useLaunchStore.getState().launches).toHaveLength(before);
    expect(screen.queryByText("Tracker")).not.toBeInTheDocument();
  });

  it("restores the previous tracker when editing is cancelled after the serial is cleared", async () => {
    const user = userEvent.setup();
    renderApp("/planning/launches");
    await user.selectOptions(screen.getByLabelText(board.group_mode), "table");
    await user.click(screen.getAllByRole("button", { name: DICTIONARY.common.actions.edit })[0]);
    await user.type(screen.getByLabelText(`${board.columns.tracker_serial} ${LAUNCH_BG1_IDS[0]}`), "TR-9");
    await user.click(screen.getByRole("button", { name: DICTIONARY.common.actions.save }));

    await user.click(screen.getAllByRole("button", { name: DICTIONARY.common.actions.edit })[0]);
    await user.clear(screen.getByLabelText(`${board.columns.tracker_serial} ${LAUNCH_BG1_IDS[0]}`));
    expect(useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0])?.tracker_model_serial_number).toBe(
      "TR-9",
    );

    await user.click(screen.getByRole("button", { name: board.cancel_changes }));
    const launch = useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0]);
    expect(launch?.tracker_model_id).toBe("tracker_1");
    expect(launch?.tracker_model_serial_number).toBe("TR-9");
  });

  it("clears the tracker when the emptied serial is saved", async () => {
    const user = userEvent.setup();
    renderApp("/planning/launches");
    await user.selectOptions(screen.getByLabelText(board.group_mode), "table");
    await user.click(screen.getAllByRole("button", { name: DICTIONARY.common.actions.edit })[0]);
    await user.type(screen.getByLabelText(`${board.columns.tracker_serial} ${LAUNCH_BG1_IDS[0]}`), "TR-9");
    await user.click(screen.getByRole("button", { name: DICTIONARY.common.actions.save }));

    await user.click(screen.getAllByRole("button", { name: DICTIONARY.common.actions.edit })[0]);
    await user.clear(screen.getByLabelText(`${board.columns.tracker_serial} ${LAUNCH_BG1_IDS[0]}`));
    await user.click(screen.getByRole("button", { name: DICTIONARY.common.actions.save }));
    expect(await screen.findByText(DICTIONARY.launches.toasts.tracker_cleared)).toBeInTheDocument();
    const launch = useLaunchStore.getState().launches.find((item) => item.id === LAUNCH_BG1_IDS[0]);
    expect(launch?.tracker_model_id).toBeNull();
    expect(launch?.tracker_model_serial_number).toBeNull();
  });
});
