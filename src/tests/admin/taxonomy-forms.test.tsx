/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TaxonomySlugField } from "@/features/admin/taxonomy/components/taxonomy-slug-field";
import { TaxonomyConflictAlert } from "@/features/admin/taxonomy/components/conflict-alert";

describe("taxonomy admin forms", () => {
  it("suggests slug from title until manually edited", async () => {
    const user = userEvent.setup();
    const onTitleChange = vi.fn();
    const onSlugChange = vi.fn();

    render(
      <TaxonomySlugField
        title=""
        slug=""
        onTitleChange={onTitleChange}
        onSlugChange={onSlugChange}
      />,
    );

    const title = screen.getByLabelText(/название/i);
    await user.type(title, "Hello");
    expect(onTitleChange).toHaveBeenCalled();
    expect(onSlugChange).toHaveBeenCalled();
  });

  it("renders conflict alert with reload action", async () => {
    const user = userEvent.setup();
    const onReload = vi.fn();
    render(<TaxonomyConflictAlert onReload={onReload} />);
    expect(screen.getByText(/конфликт версий/i)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /обновить данные/i }));
    expect(onReload).toHaveBeenCalled();
  });
});
