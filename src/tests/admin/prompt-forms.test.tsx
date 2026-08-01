/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CreatePromptForm } from "@/features/admin/prompts/components/create-prompt-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/admin/prompts/client/admin-prompts-api", () => ({
  AdminMutationClientError: class extends Error {
    code = "VALIDATION_ERROR";
    fields: Record<string, string> = {};
    status = 400;
  },
  adminPromptsApi: {
    create: vi.fn(),
  },
}));

describe("CreatePromptForm", () => {
  it("suggests slug from title and keeps manual override", async () => {
    const user = userEvent.setup();
    render(
      <CreatePromptForm
        taxonomy={{ categories: [], tags: [], audiences: [] }}
      />,
    );

    const title = screen.getByLabelText(/заголовок/i);
    await user.type(title, "Мой промт");
    const slug = screen.getByLabelText(/slug \(url\)/i) as HTMLInputElement;
    expect(slug.value.length).toBeGreaterThan(0);

    await user.clear(slug);
    await user.type(slug, "custom-slug");
    await user.type(title, " доп");
    expect(slug.value).toBe("custom-slug");
  });
});
