/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SearchFilterChips,
  type FilterChipModel,
} from "@/features/search/ui/search-filter-chips";
import { SearchPageForm } from "@/features/search/ui/search-page-form";
import type { SearchUrlState } from "@/features/search/url/search-url-state";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const baseState: SearchUrlState = {
  q: "kubernetes",
  type: "article",
  category: "unknown_cat",
  tag: "tag_1",
  audience: null,
  cursor: "cur",
};

afterEach(() => {
  cleanup();
});

describe("SearchFilterChips", () => {
  it("renders chips, unavailable label, remove and clear-all links", () => {
    const chips: FilterChipModel[] = [
      { key: "type", kindLabel: "Тип", title: "Статьи" },
      {
        key: "category",
        kindLabel: "Категория",
        title: "unknown_cat",
        unavailable: true,
      },
      { key: "tag", kindLabel: "Тег", title: "Ops" },
    ];
    render(<SearchFilterChips state={baseState} chips={chips} />);
    expect(screen.getByLabelText("Активные фильтры")).toBeInTheDocument();
    expect(screen.getByText(/Недоступный фильтр/)).toBeInTheDocument();
    const removeCategory = screen.getByRole("link", {
      name: "Удалить фильтр Категория: unknown_cat",
    });
    expect(removeCategory.getAttribute("href")).toMatch(/q=kubernetes/);
    expect(removeCategory.getAttribute("href")).not.toMatch(/cursor=/);
    expect(
      screen.getByRole("link", { name: "Очистить все фильтры" }),
    ).toHaveAttribute("href", "/search?q=kubernetes");
  });
});

describe("SearchPageForm accessibility", () => {
  it("exposes labels, disclosure, and omits cursor field", () => {
    const { container } = render(
      <SearchPageForm
        urlState={baseState}
        maxLength={120}
        categories={[{ id: "c1", title: "Cat" }]}
        tags={[{ id: "t1", title: "Tag" }]}
        audiences={[{ id: "a1", title: "Aud" }]}
      />,
    );
    expect(screen.getByLabelText("Запрос")).toBeInTheDocument();
    expect(screen.getByLabelText("Тип")).toBeInTheDocument();
    expect(screen.getByLabelText("Категория")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Найти" })).toBeInTheDocument();
    const details = container.querySelector("#search-filters-details");
    expect(details?.tagName).toBe("DETAILS");
    expect(container.querySelector('input[name="cursor"]')).toBeNull();
    expect(container.querySelector('form[action="/search"]')).toBeTruthy();
  });

  it("serializes at most one value per filter name (single control set)", () => {
    const { container } = render(
      <SearchPageForm
        urlState={baseState}
        maxLength={120}
        categories={[{ id: "c1", title: "Cat" }]}
        tags={[{ id: "t1", title: "Tag" }]}
        audiences={[{ id: "a1", title: "Aud" }]}
      />,
    );
    const form = container.querySelector("form")!;
    expect(form.querySelectorAll('[name="type"]')).toHaveLength(1);
    expect(form.querySelectorAll('[name="category"]')).toHaveLength(1);
    expect(form.querySelectorAll('[name="tag"]')).toHaveLength(1);
    expect(form.querySelectorAll('[name="audience"]')).toHaveLength(1);
    expect(form.querySelectorAll('[name="q"]')).toHaveLength(1);
    // Filters live inside one details panel (not duplicated desktop/mobile sets).
    expect(form.querySelectorAll("#search-filters-panel")).toHaveLength(1);
    expect(form.querySelectorAll("select")).toHaveLength(4);
  });
});
