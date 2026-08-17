/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RelatedPickerField } from "@/features/admin/pickers/ui/related-picker-field";
import type { PickerMaterialItem } from "@/features/admin/pickers/picker-types";

const searchMaterials = vi.fn();
const lookupMaterials = vi.fn();

vi.mock("@/features/admin/pickers/client/admin-picker-api", () => ({
  AdminPickerClientError: class extends Error {},
  isAbortError: (error: unknown) =>
    error instanceof Error && error.name === "AbortError",
  adminPickerApi: {
    searchMaterials: (...args: unknown[]) => searchMaterials(...args),
    lookupMaterials: (...args: unknown[]) => lookupMaterials(...args),
  },
}));

const article: PickerMaterialItem = {
  id: "art_1",
  title: "Инструкция по доступу",
  entityType: "article",
  status: "published",
  summary: "Как войти",
  selectable: true,
  unavailable: false,
};

const prompt: PickerMaterialItem = {
  id: "prm_1",
  title: "Суммаризация",
  entityType: "prompt",
  status: "published",
  summary: null,
  selectable: true,
  unavailable: false,
};

describe("RelatedPickerField", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  beforeEach(() => {
    searchMaterials.mockReset();
    lookupMaterials.mockReset();
    searchMaterials.mockResolvedValue({ items: [article], scanLimitExceeded: false });
    lookupMaterials.mockResolvedValue({ items: [article], scanLimitExceeded: false });
  });

  it("selects an article by title without requiring a raw ID", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RelatedPickerField
        label="Связанный материал"
        entityType="article"
        value=""
        excludeId="current"
        onChange={onChange}
      />,
    );
    expect(screen.queryByLabelText(/ID сущности/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Выбрать материал" }));
    expect(await screen.findByText(article.title)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Выбрать" }));
    expect(onChange).toHaveBeenCalledWith("art_1", "article");
  });

  it("filters current and duplicate ids from results", async () => {
    const user = userEvent.setup();
    searchMaterials.mockResolvedValue({
      items: [article, { ...article, id: "current", title: "Self" }, prompt],
      scanLimitExceeded: false,
    });
    render(
      <RelatedPickerField
        label="Связанный материал"
        entityType="article"
        value=""
        excludeId="current"
        excludeIds={["art_1"]}
        typeLocked={false}
        onChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Выбрать материал" }));
    expect(await screen.findByText("Суммаризация")).toBeTruthy();
    expect(screen.queryByText(article.title)).toBeNull();
    expect(screen.queryByText("Self")).toBeNull();
  });

  it("hydrates existing IDs and shows missing state", async () => {
    lookupMaterials.mockResolvedValue({
      items: [
        {
          id: "gone",
          title: "",
          entityType: "article",
          status: "missing",
          summary: null,
          selectable: false,
          unavailable: true,
        },
      ],
      scanLimitExceeded: false,
    });
    const onChange = vi.fn();
    render(
      <RelatedPickerField
        label="Связанный материал"
        entityType="article"
        value="gone"
        onChange={onChange}
      />,
    );
    expect(await screen.findByText("Материал недоступен")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not offer a hidden current reference as selectable", async () => {
    const user = userEvent.setup();
    lookupMaterials.mockResolvedValue({
      items: [
        {
          id: "hidden_1",
          title: "Hidden draft cousin",
          entityType: "article",
          status: "hidden",
          summary: null,
          selectable: false,
          unavailable: false,
        },
      ],
      scanLimitExceeded: false,
    });
    searchMaterials.mockResolvedValue({
      items: [
        {
          id: "hidden_1",
          title: "Hidden draft cousin",
          entityType: "article",
          status: "hidden",
          summary: null,
          selectable: false,
          unavailable: false,
        },
        article,
      ],
      scanLimitExceeded: false,
    });
    render(
      <RelatedPickerField
        label="Связанный материал"
        entityType="article"
        value="hidden_1"
        onChange={vi.fn()}
      />,
    );
    expect(await screen.findByText("Hidden draft cousin")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Выбрать материал" }));
    const dialog = await screen.findByRole("dialog", { name: "Выбор материала" });
    expect(within(dialog).getByText(article.title)).toBeTruthy();
    expect(within(dialog).queryByText("Hidden draft cousin")).toBeNull();
  });

  it("renders a hostile related title as text", async () => {
    lookupMaterials.mockResolvedValue({
      items: [
        {
          ...article,
          title: "<script>alert(1)</script>",
        },
      ],
      scanLimitExceeded: false,
    });
    render(
      <RelatedPickerField
        label="Связанный материал"
        entityType="article"
        value="art_1"
        onChange={vi.fn()}
      />,
    );
    expect(await screen.findByText("<script>alert(1)</script>")).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();
  });

  it("searches prompts", async () => {
    const user = userEvent.setup();
    searchMaterials.mockResolvedValue({ items: [prompt], scanLimitExceeded: false });
    const onChange = vi.fn();
    render(
      <RelatedPickerField
        label="Промт"
        entityType="prompt"
        value=""
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Выбрать материал" }));
    expect(await screen.findByText("Суммаризация")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Выбрать" }));
    expect(onChange).toHaveBeenCalledWith("prm_1", "prompt");
  });
});
