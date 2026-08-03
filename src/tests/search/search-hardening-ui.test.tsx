/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalSearchForm } from "@/features/search/ui/search-input-with-suggestions";
import { SearchPageForm } from "@/features/search/ui/search-page-form";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("runtime maxLength props in search forms", () => {
  afterEach(() => {
    cleanup();
  });

  it("applies custom runtime max length on page form", () => {
    const { container } = render(
      <SearchPageForm
        urlState={{
          q: "",
          type: null,
          category: null,
          tag: null,
          audience: null,
          cursor: null,
        }}
        maxLength={55}
        categories={[]}
        tags={[]}
        audiences={[]}
      />,
    );
    expect(container.querySelector("form")?.getAttribute("data-search-max-length")).toBe(
      "55",
    );
    expect(screen.getByLabelText("Запрос")).toHaveAttribute("maxLength", "55");
  });

  it("applies custom runtime max length on header form", () => {
    const { container } = render(
      <GlobalSearchForm variant="header" maxLength={77} />,
    );
    expect(container.querySelector("form")?.getAttribute("data-search-max-length")).toBe(
      "77",
    );
    expect(screen.getByLabelText("Поиск")).toHaveAttribute("maxLength", "77");
  });

  it("applies custom runtime max length on home form", () => {
    const { container } = render(
      <GlobalSearchForm variant="home" maxLength={88} />,
    );
    expect(container.querySelector("form")?.getAttribute("data-search-max-length")).toBe(
      "88",
    );
    expect(screen.getByLabelText("Поиск")).toHaveAttribute("maxLength", "88");
  });
});

describe("multiple combobox instances isolation", () => {
  beforeEach(() => {
    push.mockReset();
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        call += 1;
        return Response.json({
          status: "ok",
          items: [
            {
              kind: "title",
              label: `Item ${call}`,
              entityType: "article",
              href: "/articles/alpha",
              filterKey: null,
              filterId: null,
            },
            {
              kind: "category",
              label: "Cat",
              entityType: null,
              href: null,
              filterKey: "category",
              filterId: "c1",
            },
          ],
          incomplete: false,
        });
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps IDs, open state, keyboard, cancel, and navigation isolated", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <GlobalSearchForm variant="header" maxLength={120} />
        <SearchPageForm
          urlState={{
            q: "",
            type: null,
            category: null,
            tag: null,
            audience: null,
            cursor: null,
          }}
          maxLength={120}
          categories={[]}
          tags={[]}
          audiences={[]}
        />
      </div>,
    );

    const headerInput = screen.getByLabelText("Поиск");
    const pageInput = screen.getByLabelText("Запрос");
    expect(headerInput.id).not.toBe(pageInput.id);
    expect(headerInput.getAttribute("aria-controls")).not.toBe(
      pageInput.getAttribute("aria-controls"),
    );

    await user.type(headerInput, "al");
    await waitFor(() =>
      expect(headerInput).toHaveAttribute("aria-expanded", "true"),
    );
    expect(pageInput).toHaveAttribute("aria-expanded", "false");

    const headerActive = headerInput.getAttribute("aria-activedescendant");
    await user.keyboard("{ArrowDown}");
    const headerActiveAfter = headerInput.getAttribute("aria-activedescendant");
    expect(headerActiveAfter).not.toBe(headerActive);
    expect(pageInput.getAttribute("aria-activedescendant")).toBeNull();

    await user.keyboard("{Escape}");
    expect(headerInput).toHaveAttribute("aria-expanded", "false");

    push.mockClear();
    await user.type(pageInput, "al");
    await waitFor(() =>
      expect(pageInput).toHaveAttribute("aria-expanded", "true"),
    );
    pageInput.focus();
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/articles/alpha");
  });
});
