/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MediaPickerField } from "@/features/admin/pickers/ui/media-picker-field";
import type { PickerMediaItem } from "@/features/admin/pickers/picker-types";
import { PICKER_SEARCH_DEBOUNCE_MS } from "@/features/admin/pickers/picker-limits";

const searchMedia = vi.fn();
const lookupMedia = vi.fn();

vi.mock("@/features/admin/pickers/client/admin-picker-api", () => ({
  AdminPickerClientError: class extends Error {},
  isAbortError: (error: unknown) =>
    error instanceof Error && error.name === "AbortError",
  adminPickerApi: {
    searchMedia: (...args: unknown[]) => searchMedia(...args),
    lookupMedia: (...args: unknown[]) => lookupMedia(...args),
  },
}));

const ready: PickerMediaItem = {
  id: "media_ready",
  title: "Very long русское название изображения для карточки",
  kind: "image",
  status: "ready",
  originalFileName: "hero.jpg",
  publicPath: "/media/media_ready",
  selectable: true,
  unavailable: false,
};

describe("MediaPickerField", () => {
  afterEach(() => {
    cleanup();
  });
  beforeEach(() => {
    searchMedia.mockReset();
    lookupMedia.mockReset();
    searchMedia.mockResolvedValue({ items: [ready], scanLimitExceeded: false });
    lookupMedia.mockResolvedValue({ items: [ready], scanLimitExceeded: false });
  });

  it("opens, lists ready assets, selects by title, and does not ask for a raw ID", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MediaPickerField label="Изображение" value="" kind="image" onChange={onChange} />,
    );
    expect(screen.queryByLabelText(/Media ID/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Выбрать медиа" }));
    expect(screen.getByRole("dialog", { name: "Выбор медиа" })).toBeTruthy();
    expect(await screen.findByText(ready.title)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Выбрать" }));
    expect(onChange).toHaveBeenCalledWith("media_ready");
  });

  it("hydrates an existing value by title and allows replace/clear", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MediaPickerField
        label="Изображение"
        value="media_ready"
        kind="image"
        allowEmpty
        emptyValue="media_pending"
        onChange={onChange}
      />,
    );
    expect(await screen.findByText(ready.title)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Очистить" }));
    expect(onChange).toHaveBeenCalledWith("media_pending");
  });

  it("shows an unavailable state for missing IDs", async () => {
    lookupMedia.mockResolvedValue({
      items: [
        {
          id: "gone",
          title: "",
          kind: "image",
          status: "missing",
          originalFileName: "",
          publicPath: null,
          selectable: false,
          unavailable: true,
        },
      ],
      scanLimitExceeded: false,
    });
    render(
      <MediaPickerField label="Изображение" value="gone" kind="image" onChange={vi.fn()} />,
    );
    expect(await screen.findByText("Медиа недоступно")).toBeTruthy();
  });

  it("shows an empty library state", async () => {
    const user = userEvent.setup();
    searchMedia.mockResolvedValue({ items: [], scanLimitExceeded: false });
    render(
      <MediaPickerField label="Изображение" value="" kind="image" onChange={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "Выбрать медиа" }));
    expect(await screen.findByText("Медиа пока нет")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Открыть медиатеку" })).toHaveAttribute(
      "href",
      "/admin/media",
    );
  });

  it("does not clear an existing missing mediaId unless the user acts", async () => {
    lookupMedia.mockResolvedValue({
      items: [
        {
          id: "gone",
          title: "",
          kind: "image",
          status: "missing",
          originalFileName: "",
          publicPath: null,
          selectable: false,
          unavailable: true,
        },
      ],
      scanLimitExceeded: false,
    });
    const onChange = vi.fn();
    render(
      <MediaPickerField label="Изображение" value="gone" kind="image" onChange={onChange} />,
    );
    expect(await screen.findByText("Медиа недоступно")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders a hostile title as text, not HTML", async () => {
    lookupMedia.mockResolvedValue({
      items: [
        {
          ...ready,
          id: "media_xss",
          title: "<script>alert(1)</script><img src=x>",
          publicPath: "https://evil.example/media.png",
        },
      ],
      scanLimitExceeded: false,
    });
    render(
      <MediaPickerField
        label="Изображение"
        value="media_xss"
        kind="image"
        onChange={vi.fn()}
      />,
    );
    expect(await screen.findByText("<script>alert(1)</script><img src=x>")).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector('img[src="https://evil.example/media.png"]')).toBeNull();
  });

  it("replaces an existing ready asset with the selected id", async () => {
    const user = userEvent.setup();
    const next: PickerMediaItem = {
      ...ready,
      id: "media_next",
      title: "Replacement",
    };
    searchMedia.mockResolvedValue({ items: [next], scanLimitExceeded: false });
    const onChange = vi.fn();
    render(
      <MediaPickerField
        label="Изображение"
        value="media_ready"
        kind="image"
        onChange={onChange}
      />,
    );
    expect(await screen.findByText(ready.title)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Выбрать медиа" }));
    expect(await screen.findByText("Replacement")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Выбрать" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("media_next");
  });

  it("keeps the later search when an older request resolves late", async () => {
    const user = userEvent.setup();
    const pending: Array<(value: unknown) => void> = [];
    searchMedia.mockImplementation(
      () =>
        new Promise((resolve) => {
          pending.push(resolve);
        }),
    );
    render(
      <MediaPickerField label="Изображение" value="" kind="image" onChange={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "Выбрать медиа" }));
    expect(pending.length).toBe(1);

    fireEvent.change(screen.getByLabelText("Поиск по названию"), {
      target: { value: "abc" },
    });
    await act(async () => {
      await new Promise((resolve) => {
        window.setTimeout(resolve, PICKER_SEARCH_DEBOUNCE_MS + 20);
      });
    });
    expect(pending.length).toBe(2);

    const later = { ...ready, id: "media_b", title: "Later match" };
    const earlier = { ...ready, id: "media_a", title: "Stale match" };
    await act(async () => {
      pending[1]!({ items: [later], scanLimitExceeded: false });
    });
    expect(screen.getByText("Later match")).toBeTruthy();
    await act(async () => {
      pending[0]!({ items: [earlier], scanLimitExceeded: false });
    });
    expect(screen.queryByText("Stale match")).toBeNull();
    expect(screen.getByText("Later match")).toBeTruthy();
  });

  it("clears the debounce timer on unmount so a late tick does not search", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <MediaPickerField label="Изображение" value="" kind="image" onChange={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "Выбрать медиа" }));
    fireEvent.change(screen.getByLabelText("Поиск по названию"), {
      target: { value: "abc" },
    });
    unmount();
    const calls = searchMedia.mock.calls.length;
    await act(async () => {
      await new Promise((resolve) => {
        window.setTimeout(resolve, PICKER_SEARCH_DEBOUNCE_MS + 40);
      });
    });
    expect(searchMedia.mock.calls.length).toBe(calls);
  });

  it("isolates debounce cleanup with fake timers and no user-event", () => {
    vi.useFakeTimers();
    try {
      const view = render(
        <MediaPickerField label="Изображение" value="" kind="image" onChange={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Выбрать медиа" }));
      fireEvent.change(screen.getByLabelText("Поиск по названию"), {
        target: { value: "abc" },
      });
      const calls = searchMedia.mock.calls.length;
      view.unmount();
      vi.advanceTimersByTime(1000);
      expect(searchMedia.mock.calls.length).toBe(calls);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not show a library-empty claim when a query has no matches", async () => {
    const user = userEvent.setup();
    searchMedia.mockResolvedValue({ items: [], scanLimitExceeded: false });
    render(
      <MediaPickerField label="Изображение" value="" kind="image" onChange={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "Выбрать медиа" }));
    expect(await screen.findByText("Медиа пока нет")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Поиск по названию"), {
      target: { value: "xyz" },
    });
    await act(async () => {
      await new Promise((resolve) => {
        window.setTimeout(resolve, PICKER_SEARCH_DEBOUNCE_MS + 20);
      });
    });
    expect(screen.getByText("Нет совпадений в текущей выборке")).toBeTruthy();
    expect(screen.queryByText("Медиа пока нет")).toBeNull();
    expect(screen.queryByText(/во всей базе/i)).toBeNull();
  });

  it("closes on Escape and restores focus to the opener", async () => {
    const user = userEvent.setup();
    render(
      <MediaPickerField label="Изображение" value="" kind="image" onChange={vi.fn()} />,
    );
    const opener = screen.getByRole("button", { name: "Выбрать медиа" });
    opener.focus();
    await user.click(opener);
    expect(screen.getByRole("dialog", { name: "Выбор медиа" })).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Выбор медиа" })).toBeNull();
    });
    expect(document.activeElement).toBe(opener);
  });
});
