import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import { DICTIONARY } from "@/constants/dictionary";
import { AP_1_ID, TARGET_1_ID } from "@/data/targetSeed";
import { getEntityState } from "@/lib/entityState";
import { isValidMgrs } from "@/lib/validation";
import { signInAs } from "@/test/auth";
import { useLayoutStore } from "@/store/useLayoutStore";
import { resetTargetFilterStore } from "@/store/useTargetFilterStore";
import {
  TARGET_STORE_KEY,
  resetTargetStore,
  useTargetStore,
} from "@/store/useTargetStore";

function renderApp(initialEntry = "/catalogs/targets") {
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
  resetTargetFilterStore();
  useLayoutStore.setState({ isSidebarOpen: true });
});

afterEach(() => {
  resetTargetStore();
  resetTargetFilterStore();
});

describe("Stage 2 store", () => {
  it("persists domain state under military_crm_target_store", () => {
    useTargetStore.getState().archiveTarget(TARGET_1_ID);
    const raw = localStorage.getItem(TARGET_STORE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw ?? "{}") as { state: { targets: { id: string; archived_at: string | null }[] } };
    const stored = parsed.state.targets.find((target) => target.id === TARGET_1_ID);
    expect(stored?.archived_at).not.toBeNull();
  });

  it("cascades archive to aiming points and does not restore children", () => {
    const archivedAtBefore = useTargetStore.getState().aimingPoints.find((point) => point.id === AP_1_ID)
      ?.archived_at;
    expect(archivedAtBefore).toBeNull();

    useTargetStore.getState().archiveTarget(TARGET_1_ID);
    const state = useTargetStore.getState();
    const parent = state.targets.find((target) => target.id === TARGET_1_ID);
    const children = state.aimingPoints.filter((point) => point.target_id === TARGET_1_ID);
    expect(parent?.archived_at).not.toBeNull();
    expect(children.every((point) => point.archived_at === parent?.archived_at)).toBe(true);

    useTargetStore.getState().restoreTarget(TARGET_1_ID);
    const restored = useTargetStore.getState();
    expect(restored.targets.find((target) => target.id === TARGET_1_ID)?.archived_at).toBeNull();
    expect(
      restored.aimingPoints
        .filter((point) => point.target_id === TARGET_1_ID)
        .every((point) => point.archived_at !== null),
    ).toBe(true);
  });

  it("places a new target first and a new aiming point last", () => {
    const created = useTargetStore.getState().createTarget({
      displayed_id: "GS9999",
      name: "Тестова ціль",
      address: "Київ, Україна",
      type: "ППО",
      distance_from_hot_line: 5,
      mgrs: "36U EV 11111 22222",
      image_url: null,
    });
    expect(useTargetStore.getState().targets[0]?.id).toBe(created.id);

    const point = useTargetStore.getState().createAimingPoint(created.id, {
      displayed_id: "MP01",
      name: "Точка",
      mgrs: "36U EV 11112 22223",
      agl_msl: 2,
      feat_hgt_msl: 10,
    });
    const points = useTargetStore.getState().aimingPoints.filter((item) => item.target_id === created.id);
    expect(points.at(-1)?.id).toBe(point?.id);
  });
});

describe("Stage 2 validation", () => {
  it("accepts configured MGRS examples and rejects invalid values", () => {
    expect(isValidMgrs("36U EV 45210 88320")).toBe(true);
    expect(isValidMgrs("36UEV4521088320")).toBe(true);
    expect(isValidMgrs("invalid")).toBe(false);
  });

  it("maps entity state from archived_at and reported_at", () => {
    expect(getEntityState({ archived_at: "2026-01-01T00:00:00.000Z" })).toBe("archived");
    expect(getEntityState({ archived_at: null, reported_at: "2026-01-01T00:00:00.000Z" })).toBe("reported");
    expect(getEntityState({ archived_at: null })).toBe("active");
  });
});

describe("Stage 2 catalog UI", () => {
  it("filters by name, displayed_id and mgrs in real time", async () => {
    const user = userEvent.setup();
    renderApp();

    expect(screen.getByText("КСП 45-ї ОМБр, Краматорськ, Донецька область, Україна")).toBeInTheDocument();
    expect(screen.getByText("Склад БК південний, Оріхів, Запорізька область, Україна")).toBeInTheDocument();

    const search = screen.getByLabelText(DICTIONARY.common.actions.search);
    await user.type(search, "GS2088");
    expect(screen.queryByText(/КСП 45-ї ОМБр/)).not.toBeInTheDocument();
    expect(screen.getByText(/Склад БК південний/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: DICTIONARY.common.actions.clear }));
    await user.type(search, "36U EV 45210 88320");
    expect(screen.getByText(/КСП 45-ї ОМБр/)).toBeInTheDocument();
    expect(screen.queryByText(/Склад БК південний/)).not.toBeInTheDocument();
  });

  it("creates a target through the modal and shows dictionary toast", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: DICTIONARY.targets_catalog.buttons.create_target }));
    expect(
      screen.getByRole("dialog", { name: new RegExp(DICTIONARY.targets_catalog.modals.target.title_create) }),
    ).toBeInTheDocument();
    expect(screen.getByText("MT3")).toBeInTheDocument();

    await user.type(screen.getByLabelText(DICTIONARY.targets_catalog.fields.displayed_id), "GS3001");
    await user.type(screen.getByLabelText(DICTIONARY.targets_catalog.fields.name), "ППО пункт");
    await user.type(screen.getByLabelText(DICTIONARY.targets_catalog.fields.address), "Дніпро, Україна");
    await user.selectOptions(screen.getByLabelText(DICTIONARY.targets_catalog.fields.type), "ППО");
    await user.type(screen.getByLabelText(DICTIONARY.targets_catalog.fields.mgrs), "not-mgrs");
    expect(screen.getByText(DICTIONARY.targets_catalog.validation.mgrs)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: DICTIONARY.targets_catalog.buttons.save_target })).toBeDisabled();

    await user.clear(screen.getByLabelText(DICTIONARY.targets_catalog.fields.mgrs));
    await user.type(screen.getByLabelText(DICTIONARY.targets_catalog.fields.mgrs), "36U EV 33333 44444");
    await user.type(screen.getByLabelText(DICTIONARY.targets_catalog.fields.distance_from_hot_line), "4.2");
    await user.click(screen.getByRole("button", { name: DICTIONARY.targets_catalog.buttons.save_target }));

    expect(await screen.findByText(DICTIONARY.targets_catalog.toasts.target.saved)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useTargetStore.getState().targets[0]?.displayed_id).toBe("GS3001");
    expect(screen.getByText(/ППО пункт/)).toBeInTheDocument();
  });

  it("archives a target with cascade toast copy", async () => {
    const user = userEvent.setup();
    renderApp();

    const card = screen.getByText("GS1024").closest("div.flex.h-full") as HTMLElement;
    await user.click(within(card).getByRole("button", { name: DICTIONARY.common.actions.archive }));
    expect(screen.getByText(DICTIONARY.targets_catalog.toasts.target.archived)).toBeInTheDocument();
    expect(useTargetStore.getState().targets.find((target) => target.id === TARGET_1_ID)?.archived_at).not.toBeNull();
    expect(
      useTargetStore.getState().aimingPoints.filter((point) => point.target_id === TARGET_1_ID).every((point) => point.archived_at !== null),
    ).toBe(true);
  });
});

describe("Stage 2 create redirect", () => {
  it("opens the create target modal from the action query and drops the parameter", async () => {
    renderApp("/catalogs/targets?action=create");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: new RegExp(DICTIONARY.targets_catalog.modals.target.title_create) }),
    ).toBeInTheDocument();
  });
});

describe("Stage 2 preview UI", () => {
  it("opens preview, disables edit when archived, and creates an aiming point at list end", async () => {
    const user = userEvent.setup();
    renderApp(`/catalogs/targets/${TARGET_1_ID}`);

    expect(screen.getByRole("heading", { name: "КСП 45-ї ОМБр" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: DICTIONARY.targets_catalog.edit_toggle })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: DICTIONARY.targets_catalog.buttons.create_aiming_point }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText(DICTIONARY.targets_catalog.fields.displayed_id), "MP03");
    await user.type(within(dialog).getByLabelText(DICTIONARY.targets_catalog.fields.name), "Нова точка");
    await user.type(within(dialog).getByLabelText(DICTIONARY.targets_catalog.fields.mgrs), "36U EV 45999 88999");
    await user.type(within(dialog).getByLabelText(DICTIONARY.targets_catalog.fields.feat_hgt_msl), "10");
    await user.type(within(dialog).getByLabelText(DICTIONARY.targets_catalog.fields.agl_msl), "20");
    expect(within(dialog).getByText(DICTIONARY.targets_catalog.validation.elevation)).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: DICTIONARY.targets_catalog.buttons.save_aiming_point }),
    );
    expect(
      await screen.findAllByText(DICTIONARY.targets_catalog.validation.elevation),
    ).toHaveLength(2);

    await user.clear(within(dialog).getByLabelText(DICTIONARY.targets_catalog.fields.agl_msl));
    await user.type(within(dialog).getByLabelText(DICTIONARY.targets_catalog.fields.agl_msl), "6");
    await user.click(
      within(dialog).getByRole("button", { name: DICTIONARY.targets_catalog.buttons.save_aiming_point }),
    );
    expect(await screen.findByText(DICTIONARY.targets_catalog.toasts.aiming_point.saved)).toBeInTheDocument();
    const points = useTargetStore
      .getState()
      .aimingPoints.filter((point) => point.target_id === TARGET_1_ID);
    expect(points.at(-1)?.displayed_id).toBe("MP03");
  });
});
