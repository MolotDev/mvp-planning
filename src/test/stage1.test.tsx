import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import { signInAs } from "@/test/auth";
import { useLayoutStore } from "@/store/useLayoutStore";

function renderApp(initialEntry = "/planning/missions") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  signInAs();
});

afterEach(() => {
  useLayoutStore.setState({ isSidebarOpen: true });
});

describe("Stage 1 QA", () => {
  it("renders Ukrainian navigation labels", () => {
    renderApp();

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Планування" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Місії" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Завдання" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Пуски" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Звіти" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Довідники" })).toBeInTheDocument();
  });

  it("updates main header breadcrumb and page title without leaving the shell", async () => {
    const user = userEvent.setup();
    const { container } = renderApp();

    expect(screen.getByRole("heading", { level: 1, name: "Місії" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Планування");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Місії");

    await user.click(screen.getByRole("link", { name: "Завдання" }));
    expect(screen.getByRole("heading", { level: 1, name: "Завдання" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Завдання");
    expect(container.querySelector("nav")).toBeTruthy();

    await user.click(screen.getByRole("link", { name: "Звіти" }));
    expect(screen.getByRole("heading", { level: 1, name: "Звіти" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Звіти" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Довідники" }));
    await user.click(screen.getByRole("link", { name: "Цілі" }));
    expect(screen.getByRole("heading", { level: 1, name: "Цілі" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Довідники");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Цілі");

    await user.click(screen.getByRole("link", { name: "Засоби ураження" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Засоби ураження" }),
    ).toBeInTheDocument();
  });

  it("toggles sidebar without overflowing the layout container", async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    const shell = container.firstElementChild as HTMLElement;

    expect(shell).toHaveClass("overflow-hidden");
    expect(shell).toHaveClass("w-full");
    expect(shell).toHaveClass("h-full");

    const sidebar = container.querySelector("aside") as HTMLElement;
    expect(sidebar).toHaveClass("w-[280px]");

    const toggle = screen.getByRole("button", { name: "Перемкнути бічну панель" });
    await user.click(toggle);

    expect(useLayoutStore.getState().isSidebarOpen).toBe(false);
    expect(sidebar).toHaveClass("w-0");

    await user.click(toggle);
    expect(useLayoutStore.getState().isSidebarOpen).toBe(true);
    expect(sidebar).toHaveClass("w-[280px]");
  });

  it("keeps nested navigation indented with a left border when a group is open", () => {
    renderApp("/planning/launches");
    const planningButton = screen.getByRole("button", { name: "Планування" });
    const group = planningButton.parentElement as HTMLElement;
    const nestedList = within(group).getByRole("list");

    expect(nestedList).toHaveClass("border-l");
    expect(nestedList.className).toMatch(/pl-/);
  });

  it("uses the required sidebar toggle icons for open and closed states", async () => {
    const user = userEvent.setup();
    renderApp();

    const toggle = screen.getByRole("button", { name: "Перемкнути бічну панель" });
    expect(toggle.querySelector(".lucide-panel-left-close")).toBeTruthy();

    await user.click(toggle);
    expect(toggle.querySelector(".lucide-panel-left-open")).toBeTruthy();
  });
});
