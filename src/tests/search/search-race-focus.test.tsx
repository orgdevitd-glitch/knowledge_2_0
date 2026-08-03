/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchInputWithSuggestions } from "@/features/search/ui/search-input-with-suggestions";
import {
  consumeSearchFocusIntent,
  markSearchFocusIntent,
} from "@/features/search/ui/search-focus-intent";
import { SearchResultsFocus } from "@/features/search/ui/search-results-focus";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  window.location.hash = "";
});

describe("suggestion request race guard", () => {
  it("ignores out-of-order responses", async () => {
    const user = userEvent.setup();
    const resolvers: Array<(v: Response) => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolvers.push(resolve);
          }),
      ),
    );

    render(
      <SearchInputWithSuggestions variant="header" maxLength={120} />,
    );
    const input = screen.getByRole("combobox");
    await user.type(input, "al");
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await user.type(input, "p");
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    // Resolve B (second) first with unique label, then A (first).
    await act(async () => {
      resolvers[1]!(
        Response.json({
          status: "ok",
          items: [
            {
              kind: "title",
              label: "Second",
              entityType: "article",
              href: "/articles/second",
              filterKey: null,
              filterId: null,
            },
          ],
          incomplete: false,
        }),
      );
    });
    await waitFor(() => expect(screen.getByText("Second")).toBeInTheDocument());

    await act(async () => {
      resolvers[0]!(
        Response.json({
          status: "ok",
          items: [
            {
              kind: "title",
              label: "First-stale",
              entityType: "article",
              href: "/articles/first",
              filterKey: null,
              filterId: null,
            },
          ],
          incomplete: false,
        }),
      );
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("First-stale")).not.toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("does not reopen listbox from late response after Escape", async () => {
    const user = userEvent.setup();
    let resolveFetch!: (v: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    render(
      <SearchInputWithSuggestions variant="header" maxLength={120} />,
    );
    const input = screen.getByRole("combobox");
    await user.type(input, "al");
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");

    await act(async () => {
      resolveFetch(
        Response.json({
          status: "ok",
          items: [
            {
              kind: "title",
              label: "Late",
              entityType: "article",
              href: "/articles/late",
              filterKey: null,
              filterId: null,
            },
          ],
          incomplete: false,
        }),
      );
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Late")).not.toBeInTheDocument();
  });

  it("clears pending work when prefix becomes too short", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          status: "ok",
          items: [
            {
              kind: "title",
              label: "Alpha",
              entityType: "article",
              href: "/articles/alpha",
              filterKey: null,
              filterId: null,
            },
          ],
          incomplete: false,
        }),
      ),
    );
    render(
      <SearchInputWithSuggestions variant="header" maxLength={120} />,
    );
    const input = screen.getByRole("combobox");
    await user.type(input, "al");
    await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "true"));
    await user.clear(input);
    await user.type(input, "a");
    await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "false"));
  });
});

describe("search focus intent", () => {
  it("does not focus without explicit intent even with hash", async () => {
    window.location.hash = "#search-results";
    render(
      <section id="search-results" tabIndex={-1}>
        <h2>Results</h2>
        <SearchResultsFocus />
      </section>,
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(document.activeElement?.id).not.toBe("search-results");
  });

  it("focuses when intent was marked", async () => {
    markSearchFocusIntent();
    expect(consumeSearchFocusIntent()).toBe(true);
    markSearchFocusIntent();
    window.location.hash = "#search-results";
    render(
      <section id="search-results" tabIndex={-1}>
        <h2>Results</h2>
        <SearchResultsFocus />
      </section>,
    );
    await waitFor(() =>
      expect(document.activeElement?.id).toBe("search-results"),
    );
  });
});
