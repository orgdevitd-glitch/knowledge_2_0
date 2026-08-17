/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { taxonomyMetadataItems, TaxonomyRefList } from "@/features/public-content/ui/taxonomy-links";
import type { PublicTaxonomyRef } from "@/features/public-content/read-models";

afterEach(() => {
  cleanup();
});

const activeTag = (title: string, slug = "demo-onboarding"): PublicTaxonomyRef => ({
  id: `id-${slug}-${title}`,
  slug,
  title,
  status: "active",
});

describe("public taxonomy links", () => {
  it("renders article tags as safe catalog links", () => {
    render(<TaxonomyRefList refs={[activeTag("Онбординг")]} kind="tag" />);
    const link = screen.getByRole("link", { name: "Тег: Онбординг" });
    expect(link).toHaveAttribute("href", "/materials?tag=demo-onboarding");
  });

  it("renders category and audience catalog links", () => {
    const { rerender } = render(
      <TaxonomyRefList
        refs={[{ id: "c1", slug: "demo-guides", title: "Руководства", status: "active" }]}
        kind="category"
      />,
    );
    expect(screen.getByRole("link", { name: "Категория: Руководства" })).toHaveAttribute(
      "href",
      "/materials?category=demo-guides",
    );
    rerender(
      <TaxonomyRefList
        refs={[
          {
            id: "a1",
            slug: "demo-all-staff",
            title: "Все сотрудники",
            status: "active",
          },
        ]}
        kind="audience"
      />,
    );
    expect(screen.getByRole("link", { name: "Аудитория: Все сотрудники" })).toHaveAttribute(
      "href",
      "/materials?audience=demo-all-staff",
    );
  });

  it("shows archived titles without making them a new filter", () => {
    render(
      <TaxonomyRefList
        refs={[{ id: "t-arch", slug: "old-tag", title: "Старый тег", status: "archived" }]}
        kind="tag"
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Старый тег")).toBeInTheDocument();
    expect(screen.getByLabelText("Тег: Старый тег, архив")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("t-arch");
  });

  it("shows archived audience titles without making them a new filter", () => {
    render(
      <TaxonomyRefList
        refs={[
          {
            id: "aud-arch",
            slug: "old-audience",
            title: "Бывшая аудитория",
            status: "archived",
          },
        ]}
        kind="audience"
      />,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Бывшая аудитория")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("aud-arch");
  });

  it("treats a malicious-looking title as text", () => {
    const titles = [
      '<img src=x onerror="alert(1)">',
      "<script>alert(1)</script>",
      "javascript:alert(1)",
      "**markdown**",
      "Очень длинное русское название таксономии для проверки переноса ".repeat(3).trim(),
    ];
    for (const title of titles) {
      const { container, unmount } = render(
        <TaxonomyRefList refs={[activeTag(title, "safe-slug")]} kind="tag" />,
      );
      expect(container.querySelector("img")).toBeNull();
      expect(container.querySelector("script")).toBeNull();
      expect(container.innerHTML).not.toMatch(/dangerouslySetInnerHTML/);
      expect(screen.getByRole("link", { name: `Тег: ${title}` })).toHaveTextContent(
        title,
      );
      unmount();
    }
  });

  it("caps visible tags and keeps overflow count", () => {
    const tags = Array.from({ length: 20 }, (_, i) =>
      activeTag(`Тег ${i + 1}`, `tag-${i + 1}`),
    );
    render(<TaxonomyRefList refs={tags} kind="tag" maxVisible={3} />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByText("+17")).toBeInTheDocument();
    expect(screen.getByText("+17").tagName).toBe("SPAN");
    expect(screen.getByText("+17").closest("a")).toBeNull();
  });

  it("omits empty taxonomy rows", () => {
    const items = taxonomyMetadataItems({
      typeLabel: "Статья",
      updatedLabel: "1 янв. 2024 г.",
      categories: [],
      audiences: [],
      tags: [],
    });
    expect(items.map((i) => i.label)).toEqual(["Тип", "Обновлено"]);
  });

  it("does not render an empty tag list", () => {
    const { container } = render(<TaxonomyRefList refs={[]} kind="tag" />);
    expect(container).toBeEmptyDOMElement();
  });
});
