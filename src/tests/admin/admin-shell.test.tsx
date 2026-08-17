/** @vitest-environment jsdom */
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AdminShellChrome } from "@/features/admin/ui/admin-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/articles",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/admin/ui/sign-out-button", () => ({
  AdminSignOutButton: () => <button type="button">Выйти</button>,
}));

afterEach(() => {
  cleanup();
});

describe("AdminShellChrome", () => {
  it("renders nav items, active state, skip link, and sign out", () => {
    render(
      <AdminShellChrome>
        <p>Содержимое</p>
      </AdminShellChrome>,
    );

    expect(screen.getByRole("link", { name: "Перейти к содержимому" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Статьи" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Медиа" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Поиск" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Статьи" })[0]).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getAllByRole("button", { name: "Выйти" }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Phase 5A/i)).toBeNull();
    expect(document.querySelector("nav")).toBeTruthy();
    expect(screen.getByLabelText("Открыть навигацию")).toBeTruthy();
  });

  it("opens the mobile navigation panel", async () => {
    const user = userEvent.setup();
    render(
      <AdminShellChrome>
        <p>Содержимое</p>
      </AdminShellChrome>,
    );
    await user.click(screen.getAllByLabelText("Открыть навигацию")[0]!);
    expect(screen.getByRole("dialog", { name: "Админ" })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Админ" })).toBeNull();
  });

  it("closes the mobile panel after a nav link click", async () => {
    const user = userEvent.setup();
    render(
      <AdminShellChrome>
        <p>Содержимое</p>
      </AdminShellChrome>,
    );
    await user.click(screen.getAllByLabelText("Открыть навигацию")[0]!);
    const panel = screen.getByRole("dialog", { name: "Админ" });
    const mediaLink = within(panel).getByRole("link", { name: "Медиа" });
    mediaLink.addEventListener("click", (event) => event.preventDefault());
    await user.click(mediaLink);
    expect(screen.queryByRole("dialog", { name: "Админ" })).toBeNull();
  });
});
