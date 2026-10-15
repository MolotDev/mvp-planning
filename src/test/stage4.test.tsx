import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import { DICTIONARY } from "@/constants/dictionary";
import { LAUNCH_BG1_IDS } from "@/data/launchSeed";
import { BATTLE_GROUP_1_ID, MISSION_1_ID, TASK_1_ID, TASK_2_ID } from "@/data/missionSeed";
import { formatDateUk } from "@/lib/dates";
import { signInAs } from "@/test/auth";
import { useLayoutStore } from "@/store/useLayoutStore";
import {
  BATTLE_GROUP_STORE_KEY,
  resetBattleGroupStore,
  useBattleGroupStore,
} from "@/store/useBattleGroupStore";
import { resetLaunchFilterStore } from "@/store/useLaunchFilterStore";
import { LAUNCH_STORE_KEY, resetLaunchStore, useLaunchStore } from "@/store/useLaunchStore";
import { resetMissionStore, useMissionStore } from "@/store/useMissionStore";
import { resetTaskFilterStore } from "@/store/useTaskFilterStore";
import { resetTaskStore, TASK_STORE_KEY, useTaskStore } from "@/store/useTaskStore";
import { resetTargetStore } from "@/store/useTargetStore";

function renderApp(initialEntry = "/planning/tasks") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
      <Toaster />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  signInAs();
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

describe("Stage 4 stores", () => {
  it("persists battle groups under the required key", () => {
    useTaskStore.getState().archiveTask(TASK_1_ID);
    expect(localStorage.getItem(BATTLE_GROUP_STORE_KEY)).toBeTruthy();
    expect(localStorage.getItem(TASK_STORE_KEY)).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem(BATTLE_GROUP_STORE_KEY) ?? "{}") as {
      state: { battleGroups: { id: string; archived_at: string | null }[] };
    };
    expect(stored.state.battleGroups.find((item) => item.id === BATTLE_GROUP_1_ID)?.archived_at).not.toBeNull();
  });

  it("cascades archive to battle groups and does not restore children", () => {
    useTaskStore.getState().archiveTask(TASK_1_ID);
    const group = useBattleGroupStore.getState().battleGroups.find((item) => item.id === BATTLE_GROUP_1_ID);
    const task = useTaskStore.getState().tasks.find((item) => item.id === TASK_1_ID);
    expect(task?.archived_at).not.toBeNull();
    expect(group?.archived_at).toBe(task?.archived_at);

    useTaskStore.getState().restoreTask(TASK_1_ID);
    expect(useTaskStore.getState().tasks.find((item) => item.id === TASK_1_ID)?.archived_at).toBeNull();
    expect(
      useBattleGroupStore.getState().battleGroups.find((item) => item.id === BATTLE_GROUP_1_ID)?.archived_at,
    ).not.toBeNull();
  });

  it("cascades mission archive to tasks and battle groups", () => {
    const missionId = useTaskStore.getState().tasks.find((item) => item.id === TASK_1_ID)?.mission_id;
    expect(missionId).toBeTruthy();
    useMissionStore.getState().archiveMission(missionId!);
    expect(useTaskStore.getState().tasks.find((item) => item.id === TASK_1_ID)?.archived_at).not.toBeNull();
    expect(useTaskStore.getState().tasks.find((item) => item.id === TASK_2_ID)?.archived_at).not.toBeNull();
    expect(
      useBattleGroupStore.getState().battleGroups.every((group) => group.archived_at !== null),
    ).toBe(true);
  });
});

describe("Stage 4 tasks UI", () => {
  it("shows active tasks and battle group summaries by default", () => {
    renderApp();
    expect(screen.getByRole("heading", { level: 1, name: "Завдання" })).toBeInTheDocument();
    expect(screen.getByText("TK-1")).toBeInTheDocument();
    expect(screen.getByText("TK-2")).toBeInTheDocument();
    expect(screen.getByText("1.1.1")).toBeInTheDocument();
    expect(screen.getByText("(1.1.2)")).toBeInTheDocument();
    expect(screen.getByText("- 4 * AT-01")).toBeInTheDocument();
    expect(screen.getByText("2.1.1")).toBeInTheDocument();
    expect(screen.getByText("- 2 * AT-02")).toBeInTheDocument();
    expect(screen.getByText("1-й Загін AT-01 x 4")).toBeInTheDocument();
    expect(screen.getByText("2-й Загін AT-02 x 2")).toBeInTheDocument();
    expect(screen.queryByText(/Тривалість пусків/)).not.toBeInTheDocument();
  });

  it("pre-fills mission date and name and shows both mission tasks", () => {
    const mission = useMissionStore.getState().missions.find((item) => item.id === MISSION_1_ID);
    expect(mission).toBeTruthy();
    renderApp(`/planning/tasks?missionId=${MISSION_1_ID}`);
    expect(screen.getByLabelText(DICTIONARY.common.actions.search)).toHaveValue("Операція Заграва-1");
    const day = formatDateUk(mission!.scheduled_at);
    expect(screen.getByDisplayValue(`${day} - ${day}`)).toBeInTheDocument();
    expect(screen.getByText("TK-1")).toBeInTheDocument();
    expect(screen.getByText("TK-2")).toBeInTheDocument();
  });

  it("searches by target identity and shows empty state", async () => {
    const user = userEvent.setup();
    renderApp();
    const search = screen.getByLabelText(DICTIONARY.common.actions.search);
    await user.type(search, "GS1024");
    expect(screen.getByText("TK-1")).toBeInTheDocument();
    expect(screen.queryByText("TK-2")).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "missing-query");
    expect(screen.getByText(DICTIONARY.tasks.empty)).toBeInTheDocument();
  });

  it("filters tasks by detachment", async () => {
    const user = userEvent.setup();
    renderApp();
    const detachmentFilter = screen.getByLabelText(DICTIONARY.tasks.detachment);
    expect(detachmentFilter).toBeInTheDocument();
    await user.selectOptions(detachmentFilter, "1-й Загін");
    expect(screen.getByText("TK-1")).toBeInTheDocument();
    expect(screen.queryByText("TK-2")).not.toBeInTheDocument();
    await user.selectOptions(detachmentFilter, "2-й Загін");
    expect(screen.queryByText("TK-1")).not.toBeInTheDocument();
    expect(screen.getByText("TK-2")).toBeInTheDocument();
  });

  it("opens task preview in read-only mode with battle groups", async () => {
    const user = userEvent.setup();
    signInAs("DETACHMENT", "detachment_1");
    renderApp(`/planning/tasks/${TASK_1_ID}`);
    expect(screen.getByRole("heading", { level: 4, name: "КСП 45-ї ОМБр" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: DICTIONARY.tasks.edit_toggle })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getAllByText("1.1.1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("(1.1.2)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Пуски: 0 / 4 опрацьовано").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Залишок до розподілу: 0").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: DICTIONARY.tasks.add_battle_group })).not.toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: DICTIONARY.tasks.edit_toggle }));
    expect(screen.getByRole("button", { name: DICTIONARY.tasks.add_battle_group })).toBeInTheDocument();
  });

  it("shows the detachment crews that are still free in the battle group form", async () => {
    const user = userEvent.setup();
    signInAs("DETACHMENT", "detachment_1");
    renderApp(`/planning/tasks/${TASK_1_ID}`);
    await user.click(screen.getByRole("switch", { name: DICTIONARY.tasks.edit_toggle }));
    await user.click(screen.getByRole("button", { name: DICTIONARY.tasks.add_battle_group }));
    await user.click(screen.getByRole("combobox", { name: DICTIONARY.tasks.lead_crew }));

    expect(screen.getByRole("option", { name: "1.1.3" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "1.1.1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "1.1.2" })).not.toBeInTheDocument();
  });

  it("allows a crew booked on one day to be selected for another day", async () => {
    const user = userEvent.setup();
    const created = useMissionStore.getState().createMission(
      {
        name: "Інший день",
        scheduled_at: new Date().toISOString(),
        description: "Заявка на іншу дату",
      },
      [
        {
          target_ids: [],
          aiming_point_id: null,
          organization_id: "detachment_1",
          battle_groups_ids: [],
          asset_id: "uav_1",
          quantity: 2,
        },
      ],
    );
    const otherTask = useTaskStore.getState().tasks.find((task) => task.mission_id === created.id);
    expect(otherTask).toBeTruthy();

    signInAs("DETACHMENT", "detachment_1");
    renderApp(`/planning/tasks/${otherTask!.id}`);
    await user.click(screen.getByRole("switch", { name: DICTIONARY.tasks.edit_toggle }));
    await user.click(screen.getByRole("button", { name: DICTIONARY.tasks.add_battle_group }));
    await user.click(screen.getByRole("combobox", { name: DICTIONARY.tasks.lead_crew }));
    expect(screen.getByRole("option", { name: "1.1.1" })).toBeVisible();
    expect(screen.getByRole("option", { name: "1.1.2" })).toBeVisible();

    const saved = useBattleGroupStore.getState().createBattleGroup({
      task_id: otherTask!.id,
      lead_crew_id: "1.1.1",
      support_crew_ids: [],
      asset_id: "uav_1",
      uav_quantity: 1,
    });
    expect(saved).not.toBeNull();
    expect(
      useBattleGroupStore.getState().createBattleGroup({
        task_id: otherTask!.id,
        lead_crew_id: "1.1.1",
        support_crew_ids: [],
        asset_id: "uav_1",
        uav_quantity: 1,
      }),
    ).toBeNull();
  });

  it("blocks a battle group when execution time or the task asset limit is exceeded", async () => {
    const user = userEvent.setup();
    signInAs("DETACHMENT", "detachment_1");
    renderApp(`/planning/tasks/${TASK_1_ID}`);
    await user.click(screen.getByRole("switch", { name: DICTIONARY.tasks.edit_toggle }));
    await user.click(screen.getByRole("button", { name: DICTIONARY.common.actions.edit }));
    const quantity = screen.getByLabelText(DICTIONARY.tasks.uav_quantity);
    await user.clear(quantity);
    await user.type(quantity, "30");
    expect(
      screen.queryByText("Розрахунковий час (15.0 год) перевищує тривалість бойового чергування (10.0 год)"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Сумарна кількість засобів у БГ (30) перевищує виділений ліміт завдання (4)"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: DICTIONARY.tasks.buttons.save_battle_group })).toBeDisabled();
  });
});

describe("Stage 4 launches", () => {
  it("persists launches and keeps one record per allocated UAV", () => {
    expect(localStorage.getItem(LAUNCH_STORE_KEY)).toBeTruthy();
    const active = useLaunchStore
      .getState()
      .launches.filter((launch) => launch.battle_group_id === BATTLE_GROUP_1_ID && launch.archived_at === null);
    expect(active).toHaveLength(4);
    expect(active.every((launch) => launch.launch_status_id === "planned" && launch.reported_at === null)).toBe(
      true,
    );
  });

  it("creates and archives launches when battle group quantity changes", () => {
    const group = useBattleGroupStore.getState().battleGroups.find((item) => item.id === BATTLE_GROUP_1_ID);
    expect(group).toBeTruthy();
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
    useBattleGroupStore.getState().updateBattleGroup(BATTLE_GROUP_1_ID, {
      task_id: group!.task_id,
      lead_crew_id: group!.lead_crew_id,
      support_crew_ids: [...group!.support_crew_ids],
      asset_id: group!.asset_id,
      uav_quantity: 2,
    });
    const linked = useLaunchStore.getState().launches.filter((launch) => launch.battle_group_id === BATTLE_GROUP_1_ID);
    const active = linked.filter((launch) => launch.archived_at === null);
    expect(active).toHaveLength(2);
    expect(active.some((launch) => launch.id === LAUNCH_BG1_IDS[0] && launch.reported_at !== null)).toBe(true);
    expect(linked.filter((launch) => launch.archived_at !== null).length).toBeGreaterThan(0);

    useBattleGroupStore.getState().updateBattleGroup(BATTLE_GROUP_1_ID, {
      task_id: group!.task_id,
      lead_crew_id: group!.lead_crew_id,
      support_crew_ids: [...group!.support_crew_ids],
      asset_id: group!.asset_id,
      uav_quantity: 3,
    });
    expect(
      useLaunchStore
        .getState()
        .launches.filter((launch) => launch.battle_group_id === BATTLE_GROUP_1_ID && launch.archived_at === null),
    ).toHaveLength(3);
  });

  it("keeps processed launches and shows a quantity discrepancy when the plan is lower", () => {
    const group = useBattleGroupStore.getState().battleGroups.find((item) => item.id === BATTLE_GROUP_1_ID);
    expect(group).toBeTruthy();
    LAUNCH_BG1_IDS.forEach((id, index) => {
      useLaunchStore.getState().updateLaunch(id, {
        aiming_point_mgrs: "36U EV 45210 88320",
        asset_serial_number: `UAV-${index}`,
        ammo_model_id: "ammo_1",
        ammo_quantity: 1,
      });
    });
    useBattleGroupStore.getState().updateBattleGroup(BATTLE_GROUP_1_ID, {
      task_id: group!.task_id,
      lead_crew_id: group!.lead_crew_id,
      support_crew_ids: [...group!.support_crew_ids],
      asset_id: group!.asset_id,
      uav_quantity: 2,
    });
    const active = useLaunchStore
      .getState()
      .launches.filter((launch) => launch.battle_group_id === BATTLE_GROUP_1_ID && launch.archived_at === null);
    expect(active).toHaveLength(4);

    renderApp("/planning/tasks");
    expect(screen.getByText("Увага! Планова кількість (2) не збігається з фактичною (4)")).toBeInTheDocument();
  });

  it("renders the launches board with state metrics", () => {
    renderApp("/planning/launches");
    expect(screen.getByRole("heading", { level: 1, name: DICTIONARY.launches.title })).toBeInTheDocument();
    expect(screen.getByLabelText(DICTIONARY.tasks.launch_board.group_mode)).toHaveValue("battle_group");
    expect(screen.getByText(DICTIONARY.common.metrics.total)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: DICTIONARY.launches.buttons.report })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Всього пусків:/).length).toBeGreaterThan(0);
  });
});
