/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PromptActionsMenu } from "@/features/admin/prompts/components/prompt-actions-menu";
import { actionsForStatus } from "@/features/admin/prompts/queries";

const hide = vi.fn();
const archive = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/admin/prompts/client/admin-prompts-api", () => ({
  AdminMutationClientError: class extends Error {
    code = "INTERNAL_ERROR";
    fields = {};
    status = 500;
  },
  adminPromptsApi: {
    hide: (...args: unknown[]) => hide(...args),
    archive: (...args: unknown[]) => archive(...args),
    restoreArchive: vi.fn(),
  },
}));

describe("prompt hide/archive confirmation", () => {
  afterEach(() => {
    cleanup();
  });
  beforeEach(() => {
    hide.mockReset();
    archive.mockReset();
    hide.mockResolvedValue({ prompt: {} });
    archive.mockResolvedValue({ prompt: {} });
  });

  it("does not archive on cancel", async () => {
    const user = userEvent.setup();
    render(
      <PromptActionsMenu
        promptId="p1"
        title="Суммаризация"
        slug="sum"
        status="published"
        revision={2}
        actions={actionsForStatus("published")}
      />,
    );
    await user.click(screen.getByRole("button", { name: "В архив" }));
    const dialog = screen.getByRole("alertdialog", { name: /Архивировать промт/ });
    await user.click(within(dialog).getByRole("button", { name: "Отмена" }));
    expect(archive).not.toHaveBeenCalled();
  });

  it("archives once while pending", async () => {
    const user = userEvent.setup();
    let resolveArchive: (value: unknown) => void = () => undefined;
    archive.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveArchive = resolve;
        }),
    );
    render(
      <PromptActionsMenu
        promptId="p1"
        title="Суммаризация"
        slug="sum"
        status="published"
        revision={2}
        actions={actionsForStatus("published")}
      />,
    );
    await user.click(screen.getByRole("button", { name: "В архив" }));
    const dialog = screen.getByRole("alertdialog", { name: /Архивировать промт/ });
    const confirm = within(dialog).getByRole("button", { name: "В архив" });
    await user.click(confirm);
    expect(archive).toHaveBeenCalledTimes(1);
    await user.click(confirm);
    expect(archive).toHaveBeenCalledTimes(1);
    resolveArchive({ prompt: {} });
  });
});
