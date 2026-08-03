/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SearchResultCard } from "@/features/search/ui/search-result-card";

afterEach(() => {
  cleanup();
});

describe("SearchResultCard", () => {
  it("renders Article with structured mark and no internal metadata", () => {
    const { container } = render(
      <SearchResultCard
        entityType="article"
        title="Very long article title about onboarding process for new employees"
        href="/articles/onboarding"
        snippet={[
          { text: "Welcome to ", match: false },
          { text: "onboarding", match: true },
          { text: " guide", match: false },
        ]}
        categoryTitle="HR"
        tagTitles={["start", "process", "docs", "extra1", "extra2"]}
      />,
    );
    expect(screen.getByText("Статья")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Very long article title/ })).toHaveAttribute(
      "href",
      "/articles/onboarding",
    );
    expect(container.querySelector("mark")).toHaveTextContent("onboarding");
    expect(container.innerHTML).not.toMatch(/dangerouslySetInnerHTML/);
    expect(container.textContent).not.toMatch(/versionId|generationId|sourceRevision/);
    expect(screen.getByText(/Категория: HR/)).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("renders Prompt badge distinctly", () => {
    render(
      <SearchResultCard
        entityType="prompt"
        title="Prompt title"
        href="/prompts/p1"
        snippet={[{ text: "Use carefully", match: false }]}
      />,
    );
    expect(screen.getByText("Промт")).toBeInTheDocument();
    expect(screen.getByText(/Тип материала: Промт/)).toBeInTheDocument();
  });

  it("handles missing taxonomy title", () => {
    render(
      <SearchResultCard
        entityType="article"
        title="T"
        href="/articles/t"
        snippet={[{ text: "body", match: false }]}
        categoryTitle={null}
        tagTitles={[]}
      />,
    );
    expect(screen.queryByText(/Категория:/)).not.toBeInTheDocument();
  });
});
