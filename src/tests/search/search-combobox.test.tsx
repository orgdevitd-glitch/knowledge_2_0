/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { SEARCH_LIMIT_DEFAULTS } from "@/domain/search/search-limits";
import { SearchInputWithSuggestions } from "@/features/search/ui/search-input-with-suggestions";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("SearchInputWithSuggestions combobox", () => {
  beforeEach(() => {
    push.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          status: "ok",
          items: [
            {
              kind: "title",
              label: "Alpha Guide",
              entityType: "article",
              href: "/articles/alpha",
              filterKey: null,
              filterId: null,
            },
            {
              kind: "category",
              label: "Analytics",
              entityType: null,
              href: null,
              filterKey: "category",
              filterId: "cat_1",
            },
          ],
          incomplete: false,
        }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not request for short prefix", async () => {
    const user = userEvent.setup();
    render(
      <SearchInputWithSuggestions
        variant="header"
        maxLength={120}
        defaultQuery=""
      />,
    );
    await user.type(screen.getByRole("combobox"), "a");
    await new Promise((r) =>
      setTimeout(r, SEARCH_LIMIT_DEFAULTS.suggestionsDebounceMs + 80),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("debounces and supports keyboard selection", async () => {
    const user = userEvent.setup();
    render(
      <SearchInputWithSuggestions
        variant="page"
        urlState={{
          q: "",
          type: "article",
          category: null,
          tag: null,
          audience: null,
          cursor: "old",
        }}
        maxLength={120}
      />,
    );
    const input = screen.getByRole("combobox");
    await user.type(input, "al");
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "true"));
    expect(input).toHaveAttribute("aria-controls");
    expect(input.getAttribute("aria-activedescendant")).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(2);

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowUp}");
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/articles/alpha");
  });

  it("Escape closes listbox; click outside closes", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">outside</button>
        <SearchInputWithSuggestions variant="header" maxLength={120} />
      </div>,
    );
    const input = screen.getByRole("combobox");
    await user.type(input, "al");
    await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "true"));
    expect(screen.getByRole("listbox")).toBeVisible();
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");

    await user.clear(input);
    await user.type(input, "al");
    await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "true"));
    await user.click(screen.getByRole("button", { name: "outside" }));
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("applies taxonomy filter via suggestion and clears cursor", async () => {
    const user = userEvent.setup();
    render(
      <SearchInputWithSuggestions
        variant="page"
        urlState={{
          q: "al",
          type: null,
          category: null,
          tag: "keep",
          audience: null,
          cursor: "cur",
        }}
        defaultQuery="al"
        maxLength={120}
      />,
    );
    const input = screen.getByRole("combobox");
    await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "true"));
    input.focus();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(push).toHaveBeenCalledWith(
      expect.stringMatching(
        /\/search\?q=al&category=cat_1&tag=keep#search-results/,
      ),
    );
    expect(push.mock.calls[0]?.[0]).not.toMatch(/cursor=/);
  });

  it("does not request during IME composition", async () => {
    const user = userEvent.setup();
    render(<SearchInputWithSuggestions variant="header" maxLength={120} />);
    const input = screen.getByRole("combobox");
    await user.type(input, "al");
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const callsBefore = (fetch as unknown as { mock: { calls: unknown[] } }).mock
      .calls.length;
    input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    await user.type(input, "pha");
    await new Promise((r) =>
      setTimeout(r, SEARCH_LIMIT_DEFAULTS.suggestionsDebounceMs + 80),
    );
    expect(
      (fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length,
    ).toBe(callsBefore);
  });
});
