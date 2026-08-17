/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BLOCK_SCHEMA_VERSION, type ContentBlock } from "@/domain/content/blocks";
import { PUBLIC_CONTENT_LIMITS } from "@/features/public-content/limits";
import { buildTableOfContents } from "@/features/public-content/mappers";
import { ArticleTableOfContents } from "@/features/public-content/ui/article-toc";

afterEach(() => {
  cleanup();
});

function heading(
  id: string,
  text: string,
  level: 2 | 3 | 4 = 2,
): ContentBlock {
  return {
    id,
    type: "heading",
    schemaVersion: BLOCK_SCHEMA_VERSION,
    settings: {},
    visibility: "all",
    data: { level, text },
  };
}

describe("ArticleTableOfContents", () => {
  it("renders nothing when there are no headings", () => {
    const { container } = render(<ArticleTableOfContents items={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Содержание")).toBeNull();
  });

  it("uses the same heading data for mobile disclosure and desktop nav", () => {
    const items = buildTableOfContents([
      heading("h1", "Первый"),
      heading("h2", "Вложенный", 3),
      heading("h3", "Глубже", 4),
    ]);
    const { container } = render(<ArticleTableOfContents items={items} />);
    const navs = screen.getAllByRole("navigation", { name: "Содержание" });
    expect(navs.length).toBe(2);
    expect(container.querySelector("summary")).toHaveTextContent("Содержание");
    expect(container.querySelector("h2")).toHaveTextContent("Содержание");
    const links = screen.getAllByRole("link", { name: "Первый" });
    expect(links[0]).toHaveAttribute("href", `#${items[0]!.anchor}`);
    expect(screen.getAllByRole("link", { name: "Вложенный" })[0]).toHaveAttribute(
      "href",
      `#${items[1]!.anchor}`,
    );
  });

  it("keeps native anchors for 30 nested Russian headings", () => {
    const blocks = Array.from({ length: 30 }, (_, index) =>
      heading(
        `h-${index}`,
        `Очень длинный русский заголовок раздела ${index + 1} про онбординг`,
        index % 3 === 0 ? 2 : index % 3 === 1 ? 3 : 4,
      ),
    );
    const items = buildTableOfContents(blocks);
    expect(items).toHaveLength(30);
    const { container } = render(<ArticleTableOfContents items={items} />);
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs.every((href) => href?.startsWith("#"))).toBe(true);
    expect(container.textContent).toContain("Очень длинный русский заголовок раздела 30");
  });

  it("caps the TOC at 40 headings from one shared list", () => {
    expect(buildTableOfContents([heading("only", "Один")])).toHaveLength(1);
    expect(
      buildTableOfContents(
        Array.from({ length: 40 }, (_, index) => heading(`h-${index}`, `Раздел ${index + 1}`)),
      ),
    ).toHaveLength(40);
    const over = buildTableOfContents(
      Array.from({ length: 41 }, (_, index) => heading(`h-${index}`, `Раздел ${index + 1}`)),
    );
    expect(over).toHaveLength(PUBLIC_CONTENT_LIMITS.tocMaxItems);
    expect(over.at(-1)?.text).toBe("Раздел 40");
  });

  it("keeps duplicate Russian headings unique and stable", () => {
    const items = buildTableOfContents([
      heading("a", "Настройка"),
      heading("b", "Настройка"),
      heading("c", "Настройка"),
    ]);
    const anchors = items.map((item) => item.anchor);
    expect(new Set(anchors).size).toBe(3);
    expect(anchors[0]).toBe("настройка");
    expect(anchors[1]).toBe("настройка-2");
    expect(anchors[2]).toBe("настройка-3");
    const { container } = render(<ArticleTableOfContents items={items} />);
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "#настройка",
      "#настройка-2",
      "#настройка-3",
      "#настройка",
      "#настройка-2",
      "#настройка-3",
    ]);
  });

  it("builds safe native anchors for punctuation and empty-ish headings", () => {
    const items = buildTableOfContents([
      heading("cyr", "Настройка / доступ"),
      heading("hash", "Раздел #1 50%"),
      heading("empty", "   ***   "),
    ]);
    expect(items[0]?.anchor).toBe("настройка-доступ");
    expect(items[1]?.anchor).toMatch(/^[a-z0-9а-яё-]+$/);
    expect(items[2]?.anchor).toBe("section-empty");
    expect(items.every((item) => !item.anchor.includes("#") && !item.anchor.includes("%"))).toBe(
      true,
    );
  });
});
