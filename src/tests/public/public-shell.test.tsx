/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const navMocks = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navMocks.pathname,
}));

import { PublicShellChrome } from "@/features/public-content/ui/public-shell";

afterEach(() => {
  cleanup();
  navMocks.pathname = "/";
});

describe("PublicShellChrome navigation", () => {
  it("renders Search as a link with visible focus target", () => {
    navMocks.pathname = "/search";
    render(
      <PublicShellChrome>
        <p>Контент</p>
      </PublicShellChrome>,
    );
    const searchLinks = screen.getAllByRole("link", { name: "Поиск" });
    expect(searchLinks.length).toBeGreaterThan(0);
    expect(searchLinks[0]).toHaveAttribute("href", "/search");
    expect(searchLinks[0]).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link", { name: "Все материалы" })[0]).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("does not duplicate Search and keeps assistant hidden by default", () => {
    render(
      <PublicShellChrome>
        <p>Контент</p>
      </PublicShellChrome>,
    );
    expect(screen.getAllByRole("link", { name: "Поиск" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Ассистент" })).toBeNull();
  });

  it("closes the mobile panel after a Search navigation click", async () => {
    const user = userEvent.setup();
    render(
      <PublicShellChrome>
        <p>Контент</p>
      </PublicShellChrome>,
    );
    await user.click(screen.getAllByLabelText("Открыть навигацию")[0]!);
    const panel = screen.getByRole("dialog", { name: "Навигация" });
    const searchLink = within(panel).getByRole("link", { name: "Поиск" });
    searchLink.addEventListener("click", (event) => event.preventDefault());
    await user.click(searchLink);
    expect(screen.queryByRole("dialog", { name: "Навигация" })).toBeNull();
  });

  it("closes the mobile panel on Escape and restores the opener focus", async () => {
    const user = userEvent.setup();
    render(
      <PublicShellChrome>
        <p>Контент</p>
      </PublicShellChrome>,
    );
    const opener = screen.getAllByLabelText("Открыть навигацию")[0]!;
    await user.click(opener);
    expect(screen.getByRole("dialog", { name: "Навигация" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Навигация" })).toBeNull();
    expect(opener).toHaveFocus();
  });
});
