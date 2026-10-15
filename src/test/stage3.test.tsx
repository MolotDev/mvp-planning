import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import { DICTIONARY } from "@/constants/dictionary";
import { MISSION_1_ID, TASK_1_ID, TASK_2_ID } from "@/data/missionSeed";
import { AP_1_ID, AP_2_ID, TARGET_1_ID } from "@/data/targetSeed";
import { isScheduledBeforeCreated, formatDateUk } from "@/lib/dates";
import { toTaskDrafts, draftsFromMission } from "@/lib/missionForm";
import { resetBattleGroupStore } from "@/store/useBattleGroupStore";
import { resetLaunchFilterStore } from "@/store/useLaunchFilterStore";
import { resetLaunchStore } from "@/store/useLaunchStore";
import { signInAs } from "@/test/auth";
import { useLayoutStore } from "@/store/useLayoutStore";
import { resetMissionFilterStore } from "@/store/useMissionFilterStore";
import { resetTaskFilterStore } from "@/store/useTaskFilterStore";
import { MISSION_STORE_KEY, resetMissionStore, useMissionStore } from "@/store/useMissionStore";
import { resetTaskStore, TASK_STORE_KEY, useTaskStore, normalizeTask } from "@/store/useTaskStore";
import { resetTargetStore } from "@/store/useTargetStore";
import type { Task } from "@/types/mission";

function renderApp(initialEntry = "/planning/missions") {
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
  resetTaskStore();
  resetMissionStore();
  resetBattleGroupStore();
  resetLaunchStore();
  resetTaskFilterStore();
  resetLaunchFilterStore();
  resetMissionFilterStore();
  useLayoutStore.setState({ isSidebarOpen: true });
});

afterEach(() => {
  resetTargetStore();
  resetTaskStore();
  resetMissionStore();
  resetBattleGroupStore();
  resetLaunchStore();
  resetTaskFilterStore();
  resetLaunchFilterStore();
  resetMissionFilterStore();
});

describe("Stage 3 stores", () => {
  it("persists missions and tasks under the required keys", () => {
    useMissionStore.getState().archiveMission(MISSION_1_ID);
    expect(localStorage.getItem(MISSION_STORE_KEY)).toBeTruthy();
    expect(localStorage.getItem(TASK_STORE_KEY)).toBeTruthy();
    const missions = JSON.parse(localStorage.getItem(MISSION_STORE_KEY) ?? "{}") as {
      state: { missions: { id: string; archived_at: string | null }[] };
    };
    expect(missions.state.missions.find((item) => item.id === MISSION_1_ID)?.archived_at).not.toBeNull();
  });

  it("normalizes persisted tasks that omit target_ids", () => {
    const incomplete = { ...useTaskStore.getState().tasks[0] } as Task;
    delete (incomplete as { target_ids?: string[] }).target_ids;
    expect(normalizeTask(incomplete).target_ids).toEqual([]);
  });

  it("cascades archive to tasks and does not restore children", () => {
    useMissionStore.getState().archiveMission(MISSION_1_ID);
    const archived = useTaskStore.getState().tasks.filter((task) => [TASK_1_ID, TASK_2_ID].includes(task.id));
    const parent = useMissionStore.getState().missions.find((mission) => mission.id === MISSION_1_ID);
    expect(parent?.archived_at).not.toBeNull();
    expect(archived.every((task) => task.archived_at === parent?.archived_at)).toBe(true);

    useMissionStore.getState().restoreMission(MISSION_1_ID);
    expect(useMissionStore.getState().missions.find((mission) => mission.id === MISSION_1_ID)?.archived_at).toBeNull();
    expect(
      useTaskStore
        .getState()
        .tasks.filter((task) => [TASK_1_ID, TASK_2_ID].includes(task.id))
        .every((task) => task.archived_at !== null),
    ).toBe(true);
  });

  it("creates a new mission as the first card with generated tasks", () => {
    const created = useMissionStore.getState().createMission(
      {
        name: "Нова місія",
        scheduled_at: new Date().toISOString(),
        description: "Опис нової місії",
      },
      [
        {
          target_ids: [],
          aiming_point_id: null,
          organization_id: "detachment_3",
          battle_groups_ids: [],
          asset_id: "uav_3",
          quantity: 1,
        },
      ],
    );
    expect(useMissionStore.getState().missions[0]?.id).toBe(created.id);
    expect(created.label).toBe("MN-3");
    expect(created.task_ids).toHaveLength(1);
    expect(useTaskStore.getState().tasks.some((task) => task.label === "TK-3")).toBe(true);
  });

  it("creates one task per allocation row", () => {
    const drafts = toTaskDrafts([
      {
        key: "target-a",
        target_id: TARGET_1_ID,
        aiming_point_ids: [],
        detachments: [
          { key: "d1", organization_id: "detachment_1", asset_id: "uav_1", quantity: "4", aiming_point_id: AP_1_ID },
          { key: "d2", organization_id: "detachment_1", asset_id: "uav_2", quantity: "2", aiming_point_id: AP_2_ID },
          { key: "d3", organization_id: "detachment_2", asset_id: "uav_3", quantity: "1" },
        ],
      },
    ]);
    expect(drafts).toHaveLength(3);
    expect(drafts[0]).toMatchObject({
      target_ids: [TARGET_1_ID],
      aiming_point_id: AP_1_ID,
      organization_id: "detachment_1",
      asset_id: "uav_1",
      quantity: 4,
    });
    expect(drafts[1]).toMatchObject({
      aiming_point_id: AP_2_ID,
      organization_id: "detachment_1",
      asset_id: "uav_2",
      quantity: 2,
    });
    expect(drafts[2]).toMatchObject({
      aiming_point_id: null,
      organization_id: "detachment_2",
      asset_id: "uav_3",
      quantity: 1,
    });
  });

  it("does not create a task for a target without an allocation row", () => {
    expect(
      toTaskDrafts([
        {
          key: "target-only",
          target_id: TARGET_1_ID,
          aiming_point_ids: [AP_1_ID, AP_2_ID],
          detachments: [],
        },
      ]),
    ).toHaveLength(0);

    const created = useMissionStore.getState().createMission(
      {
        name: "Місія з ціллю",
        scheduled_at: new Date().toISOString(),
        description: "Опис",
      },
      [
        {
          target_ids: [TARGET_1_ID],
          aiming_point_id: AP_1_ID,
          organization_id: "detachment_1",
          battle_groups_ids: [],
          asset_id: "uav_1",
          quantity: 2,
        },
      ],
    );
    expect(created.task_ids).toHaveLength(1);
    const task = useTaskStore.getState().tasks.find((item) => item.id === created.task_ids[0]);
    expect(task).toMatchObject({
      target_ids: [TARGET_1_ID],
      aiming_point_id: AP_1_ID,
      organization_id: "detachment_1",
      asset_id: "uav_1",
      quantity: 2,
    });
    const formDrafts = draftsFromMission(created, useTaskStore.getState().tasks);
    expect(formDrafts).toHaveLength(1);
    expect(formDrafts[0]?.target_id).toBe(TARGET_1_ID);
    expect(formDrafts[0]?.aiming_point_ids).toEqual([AP_1_ID]);
    expect(formDrafts[0]?.detachments[0]).toMatchObject({
      task_id: task?.id,
      aiming_point_id: AP_1_ID,
      asset_id: "uav_1",
      quantity: "2",
    });
  });

  it("updates existing tasks on mission edit and archives removed pairs", () => {
    const mission = useMissionStore.getState().missions.find((item) => item.id === MISSION_1_ID);
    const original = useTaskStore.getState().tasks.find((item) => item.id === TASK_1_ID);
    expect(mission).toBeTruthy();
    expect(original).toBeTruthy();
    useMissionStore.getState().updateMission(
      MISSION_1_ID,
      {
        name: mission!.name,
        scheduled_at: mission!.scheduled_at,
        description: mission!.description,
      },
      [
        {
          id: TASK_1_ID,
          target_ids: [...original!.target_ids],
          aiming_point_id: original!.aiming_point_id,
          organization_id: original!.organization_id,
          battle_groups_ids: [],
          asset_id: "uav_1",
          quantity: 8,
        },
        {
          target_ids: [...original!.target_ids],
          aiming_point_id: null,
          organization_id: original!.organization_id,
          battle_groups_ids: [],
          asset_id: "uav_2",
          quantity: 3,
        },
      ],
    );
    const updated = useTaskStore.getState().tasks.find((item) => item.id === TASK_1_ID);
    expect(updated?.archived_at).toBeNull();
    expect(updated?.label).toBe("TK-1");
    expect(updated?.asset_id).toBe("uav_1");
    expect(updated?.quantity).toBe(8);
    expect(useTaskStore.getState().tasks.find((item) => item.id === TASK_2_ID)?.archived_at).not.toBeNull();
    const missionTaskIds = useMissionStore.getState().missions.find((item) => item.id === MISSION_1_ID)?.task_ids ?? [];
    expect(missionTaskIds).toHaveLength(2);
    expect(missionTaskIds).toContain(TASK_1_ID);
    expect(
      useTaskStore.getState().tasks.some((item) => item.mission_id === MISSION_1_ID && item.asset_id === "uav_2" && item.quantity === 3 && item.archived_at === null),
    ).toBe(true);
  });

  it("rejects a scheduled date earlier than created_at", () => {
    expect(isScheduledBeforeCreated("2020-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z")).toBe(true);
    expect(isScheduledBeforeCreated("2026-01-02T00:00:00.000Z", "2026-01-02T12:00:00.000Z")).toBe(false);
  });
});

describe("Stage 3 missions UI", () => {
  it("shows every mission by default and filters by status and target identity", async () => {
    const user = userEvent.setup();
    renderApp();

    expect(screen.getByRole("heading", { level: 1, name: "Місії" })).toBeInTheDocument();
    expect(screen.getByText("Операція Заграва-1")).toBeInTheDocument();
    expect(screen.getByText("Перехоплення Бета")).toBeInTheDocument();

    const status = screen.getByRole("combobox", { name: DICTIONARY.assets.columns.status });
    await user.selectOptions(status, "archived");
    expect(screen.getByText("Перехоплення Бета")).toBeInTheDocument();
    expect(screen.queryByText("Операція Заграва-1")).not.toBeInTheDocument();

    await user.selectOptions(status, "active");
    const search = screen.getByLabelText(DICTIONARY.common.actions.search);
    await user.type(search, "GS1024");
    expect(screen.getByText("Операція Заграва-1")).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "missing-query");
    expect(screen.getByText(DICTIONARY.missions.empty_state)).toBeInTheDocument();
  });

  it("renders the missions catalog when persisted tasks omit target_ids", () => {
    const [first, ...rest] = useTaskStore.getState().tasks;
    const incomplete = { ...first } as Task;
    delete (incomplete as { target_ids?: string[] }).target_ids;
    useTaskStore.setState({ tasks: [incomplete, ...rest] });
    renderApp();
    expect(screen.getByRole("heading", { level: 1, name: "Місії" })).toBeInTheDocument();
    expect(screen.getByText("Операція Заграва-1")).toBeInTheDocument();
  });

  it("opens mission tasks with the mission date, name, and both assignments", async () => {
    const user = userEvent.setup();
    const mission = useMissionStore.getState().missions.find((item) => item.id === MISSION_1_ID);
    expect(mission).toBeTruthy();
    renderApp();
    await user.click(screen.getByRole("button", { name: DICTIONARY.missions.preview_tasks }));
    expect(screen.getByRole("heading", { level: 1, name: "Завдання" })).toBeInTheDocument();
    expect(screen.getByLabelText(DICTIONARY.common.actions.search)).toHaveValue("Операція Заграва-1");
    const day = formatDateUk(mission!.scheduled_at);
    expect(screen.getByDisplayValue(`${day} - ${day}`)).toBeInTheDocument();
    expect(screen.getByText("TK-1")).toBeInTheDocument();
    expect(screen.getByText("TK-2")).toBeInTheDocument();
  });

  it("creates a basic mission from the modal and stays on the catalog", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: DICTIONARY.missions.create_button }));
    expect(
      screen.getByRole("dialog", { name: new RegExp(DICTIONARY.missions.modals.title_create) }),
    ).toBeInTheDocument();
    expect(screen.getByText("MN-3")).toBeInTheDocument();

    await user.type(screen.getByLabelText(DICTIONARY.missions.fields.description), "Базова місія без завдань");
    const dateInput = document.querySelector("#scheduled_at") as HTMLInputElement | null;
    expect(dateInput).toBeTruthy();
    await user.click(dateInput!);
    const dayButtons = document.querySelectorAll(".react-datepicker__day:not(.react-datepicker__day--disabled)");
    const today = [...dayButtons].find((button) =>
      button.className.includes("react-datepicker__day--today"),
    ) as HTMLElement | undefined;
    if (today) {
      await user.click(today);
    } else if (dayButtons[0]) {
      await user.click(dayButtons[0] as HTMLElement);
    }

    await user.click(screen.getByRole("button", { name: DICTIONARY.missions.buttons.save_mission }));
    expect(await screen.findByText(DICTIONARY.missions.toasts.created)).toBeInTheDocument();
    expect(useMissionStore.getState().missions[0]?.description).toBe("Базова місія без завдань");
  });

  it("opens mission preview in read-only mode with grouped progress cards", async () => {
    const user = userEvent.setup();
    renderApp(`/planning/missions/${MISSION_1_ID}`);

    expect(screen.getByRole("heading", { level: 4, name: "MN-1 — Операція Заграва-1" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: DICTIONARY.missions.edit_toggle })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByLabelText(DICTIONARY.missions.fields.description)).toBeDisabled();
    expect(screen.getByRole("heading", { level: 5, name: DICTIONARY.missions.progress_title })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: DICTIONARY.missions.group_by_target })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getAllByText("GS1024").length).toBeGreaterThan(0);
    expect(screen.getAllByText(DICTIONARY.missions.execution_info).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("tab", { name: DICTIONARY.missions.group_by_detachment }));
    expect(screen.getAllByText("detachment_1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("detachment_2").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("switch", { name: DICTIONARY.missions.edit_toggle }));
    expect(screen.getByLabelText(DICTIONARY.missions.fields.description)).toBeEnabled();
    expect(screen.getByRole("button", { name: DICTIONARY.missions.buttons.save_mission })).toBeEnabled();
    expect(screen.getByRole("button", { name: DICTIONARY.common.actions.cancel })).toBeEnabled();

    await user.clear(screen.getByLabelText(DICTIONARY.missions.fields.description));
    await user.type(screen.getByLabelText(DICTIONARY.missions.fields.description), "Оновлена оперативна мета");
    await user.click(screen.getByRole("button", { name: DICTIONARY.missions.buttons.save_mission }));
    expect(await screen.findByText(DICTIONARY.missions.toasts.updated)).toBeInTheDocument();
    expect(useMissionStore.getState().missions.find((item) => item.id === MISSION_1_ID)?.description).toBe(
      "Оновлена оперативна мета",
    );
    const activeTasks = useTaskStore
      .getState()
      .tasks.filter((task) => task.mission_id === MISSION_1_ID && task.archived_at === null);
    expect(activeTasks).toHaveLength(2);
    expect(screen.getAllByText("AT-01 × 4")).toHaveLength(1);
    expect(screen.getAllByText("AT-02 × 2")).toHaveLength(1);
  });

  it("cancels mission preview edits and returns to the catalog", async () => {
    const user = userEvent.setup();
    renderApp(`/planning/missions/${MISSION_1_ID}`);
    await user.click(screen.getByRole("switch", { name: DICTIONARY.missions.edit_toggle }));
    await user.clear(screen.getByLabelText(DICTIONARY.missions.fields.description));
    await user.type(screen.getByLabelText(DICTIONARY.missions.fields.description), "Чернетка");
    await user.click(screen.getByRole("button", { name: DICTIONARY.common.actions.cancel }));
    expect(screen.getByRole("heading", { level: 1, name: "Місії" })).toBeInTheDocument();
    expect(useMissionStore.getState().missions.find((item) => item.id === MISSION_1_ID)?.description).not.toBe(
      "Чернетка",
    );
  });

  it("shows assigned tasks when previewing an archived mission and disables edit", () => {
    useMissionStore.getState().archiveMission(MISSION_1_ID);
    renderApp(`/planning/missions/${MISSION_1_ID}`);

    expect(screen.getByRole("heading", { level: 4, name: "MN-1 — Операція Заграва-1" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: DICTIONARY.missions.edit_toggle })).toBeDisabled();
    expect(screen.getAllByText("GS1024").length).toBeGreaterThan(0);
    expect(screen.getAllByText("GS2088").length).toBeGreaterThan(0);
    expect(screen.getByText("AT-01 × 4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: DICTIONARY.missions.add_target })).not.toBeInTheDocument();
  });

  it("hides the edit toggle on a reported mission", () => {
    useMissionStore.setState((state) => ({
      missions: state.missions.map((mission) =>
        mission.id === MISSION_1_ID ? { ...mission, reported_at: new Date().toISOString() } : mission,
      ),
    }));
    renderApp(`/planning/missions/${MISSION_1_ID}`);

    expect(screen.getByRole("heading", { level: 4, name: "MN-1 — Операція Заграва-1" })).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: DICTIONARY.missions.edit_toggle })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: DICTIONARY.missions.add_target })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: DICTIONARY.common.actions.delete })).toHaveLength(0);
  });
});
