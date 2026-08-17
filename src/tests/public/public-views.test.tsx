/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { Alert } from "@/components/ui";
import { BLOCK_SCHEMA_VERSION } from "@/domain/content/blocks";
import { buildArticleDetail, buildPromptDetail } from "@/features/public-content/build-detail";
import type { MaterialSummary } from "@/features/public-content/read-models";
import { ArticlePublicView } from "@/features/public-content/ui/article-public-view";
import { PromptPublicView } from "@/features/public-content/ui/prompt-public-view";
import { MaterialCard } from "@/features/public-content/ui/catalog";
import { loadDemoCatalog } from "@/server/content-sources/demo/load-demo-catalog";

afterEach(() => {
  cleanup();
});

const now = "2024-06-15T12:00:00.000Z";

function cardItem(overrides: Partial<MaterialSummary> = {}): MaterialSummary {
  return {
    id: "card-1",
    type: "article",
    slug: "card-1",
    title: "Карточка",
    summary: "Краткое описание",
    category: {
      id: "c1",
      slug: "demo-guides",
      title: "Руководства",
      status: "active",
    },
    tags: Array.from({ length: 8 }, (_, i) => ({
      id: `tag-${i}`,
      slug: `tag-${i}`,
      title: `Метка ${i + 1}`,
      status: "active" as const,
    })),
    audiences: [],
    updatedAt: now,
    publishedAt: now,
    reviewStatus: null,
    url: "/articles/card-1",
    ...overrides,
  };
}

describe("public presentational views", () => {
  it("renders article tags, category links, and TOC from the shared view", () => {
    const catalog = loadDemoCatalog();
    const article = catalog.articles.find((a) => a.slug === "getting-started-portal")!;
    const detail = buildArticleDetail(article, catalog, now);
    const { container } = render(
      <ArticlePublicView article={detail} resolvedMedia={{}} />,
    );
    expect(screen.getByRole("heading", { level: 1, name: article.title })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(container.querySelector("main")).toBeNull();
    expect(screen.queryByText("Актуально")).toBeNull();
    expect(screen.getAllByRole("link", { name: /Категория:/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Тег:/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("navigation", { name: "Содержание" }).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain(article.id);
  });

  it("renders prompt tags and body through the shared view", () => {
    const catalog = loadDemoCatalog();
    const prompt = catalog.prompts.find((p) => p.slug === "demo-summarize-text")!;
    const detail = buildPromptDetail(prompt, catalog, now);
    const { container } = render(<PromptPublicView prompt={detail} />);
    expect(screen.getByRole("heading", { level: 1, name: prompt.title })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(container.querySelector("main")).toBeNull();
    expect(screen.getByRole("heading", { name: "Текст промта" })).toBeInTheDocument();
    expect(document.querySelector("pre")).toHaveTextContent(/Сожми следующий текст/);
    expect(screen.getAllByRole("link", { name: /Тег:/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /копировать текст промта/i })).toBeInTheDocument();
    expect(screen.queryByText("Актуально")).toBeNull();
  });

  it("keeps the preview banner out of the heading outline", () => {
    render(<Alert tone="information" title="Предпросмотр черновика">Черновик</Alert>);
    expect(screen.getByRole("status").querySelector("h1, h2, h3")).toBeNull();
    expect(screen.getByText("Предпросмотр черновика").tagName).toBe("P");
  });

  it("does not nest taxonomy links inside the material title link", () => {
    const { container } = render(<MaterialCard item={cardItem()} />);
    expect(container.querySelector("a a")).toBeNull();
    expect(container.querySelector("article > a")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
    const title = screen.getByRole("link", { name: "Карточка" });
    expect(title).toHaveAttribute("href", "/articles/card-1");
    expect(title.closest("h2")).toBeTruthy();
    const category = screen.getByRole("link", { name: "Категория: Руководства" });
    expect(category).toHaveAttribute("href", "/materials?category=demo-guides");
    expect(title.contains(category)).toBe(false);
    expect(screen.getAllByRole("link", { name: /Тег:/ })).toHaveLength(3);
    expect(screen.getByText("+5").tagName).toBe("SPAN");
    expect(screen.getByText("+5").closest("a")).toBeNull();
    expect(screen.queryByText("Актуально")).toBeNull();
  });

  it("tabs from the title to sibling taxonomy links without a card wrapper target", async () => {
    const user = userEvent.setup();
    render(<MaterialCard item={cardItem()} />);
    await user.tab();
    expect(screen.getByRole("link", { name: "Карточка" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Категория: Руководства" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Тег: Метка 1" })).toHaveFocus();
  });

  it("does not create twenty tag links on a card", () => {
    render(
      <MaterialCard
        item={cardItem({
          tags: Array.from({ length: 20 }, (_, i) => ({
            id: `tag-${i}`,
            slug: `tag-${i}`,
            title: `Метка ${i + 1}`,
            status: "active" as const,
          })),
        })}
      />,
    );
    expect(screen.getAllByRole("link", { name: /Тег:/ })).toHaveLength(3);
    expect(screen.getByText("+17")).toBeInTheDocument();
  });

  it("falls back for unavailable media without showing the raw id", () => {
    const catalog = loadDemoCatalog();
    const article = catalog.articles.find((a) => a.slug === "getting-started-portal")!;
    const detail = buildArticleDetail(
      {
        ...article,
        blocks: [
          {
            id: "img-1",
            type: "image",
            schemaVersion: BLOCK_SCHEMA_VERSION,
            settings: {},
            visibility: "all",
            data: {
              mediaId: "secret_media_id_xyz",
              alt: "Схема процесса",
              decorative: false,
            },
          },
        ],
      },
      catalog,
      now,
    );
    render(
      <ArticlePublicView
        article={detail}
        resolvedMedia={{
          secret_media_id_xyz: { status: "unavailable", reason: "not-found" },
        }}
      />,
    );
    expect(screen.getByText("Схема процесса")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("secret_media_id_xyz");
    expect(document.body.innerHTML).not.toContain("storage.googleapis.com");
  });
});
