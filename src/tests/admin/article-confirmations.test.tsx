/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ArticleActionsMenu } from "@/features/admin/articles/components/article-actions-menu";
import { actionsForStatus } from "@/features/admin/articles/queries";

const hide = vi.fn();
const archive = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/admin/articles/client/admin-articles-api", () => ({
  AdminMutationClientError: class extends Error {
    code = "INTERNAL_ERROR";
    fields = {};
    status = 500;
  },
  adminArticlesApi: {
    hide: (...args: unknown[]) => hide(...args),
    archive: (...args: unknown[]) => archive(...args),
    restoreArchive: vi.fn(),
  },
}));

describe("article hide/archive confirmation", () => {
  afterEach(() => {
    cleanup();
  });
  beforeEach(() => {
    hide.mockReset();
    archive.mockReset();
    hide.mockResolvedValue({ article: {} });
    archive.mockResolvedValue({ article: {} });
  });

  it("requires confirmation for hide and does not mutate on cancel", async () => {
    const user = userEvent.setup();
    render(
      <ArticleActionsMenu
        articleId="a1"
        title="Регламент"
        slug="reglament"
        status="published"
        revision={2}
        actions={actionsForStatus("published")}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Скрыть" }));
    const hideDialog = screen.getByRole("alertdialog", { name: /Скрыть статью/ });
    await user.click(within(hideDialog).getByRole("button", { name: "Отмена" }));
    expect(hide).not.toHaveBeenCalled();
  });

  it("archives once after confirm and blocks a second click while pending", async () => {
    const user = userEvent.setup();
    let resolveArchive: (value: unknown) => void = () => undefined;
    archive.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveArchive = resolve;
        }),
    );
    render(
      <ArticleActionsMenu
        articleId="a1"
        title="Регламент"
        slug="reglament"
        status="published"
        revision={2}
        actions={actionsForStatus("published")}
      />,
    );
    await user.click(screen.getByRole("button", { name: "В архив" }));
    const dialog = screen.getByRole("alertdialog", { name: /Архивировать статью/ });
    const confirm = within(dialog).getByRole("button", { name: "В архив" });
    await user.click(confirm);
    expect(archive).toHaveBeenCalledTimes(1);
    await user.click(confirm);
    expect(archive).toHaveBeenCalledTimes(1);
    resolveArchive({ article: {} });
  });

  it("hides once after confirm and does not say delete", async () => {
    const user = userEvent.setup();
    let resolveHide: (value: unknown) => void = () => undefined;
    hide.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveHide = resolve;
        }),
    );
    render(
      <ArticleActionsMenu
        articleId="a1"
        title="Регламент"
        slug="reglament"
        status="published"
        revision={2}
        actions={actionsForStatus("published")}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Скрыть" }));
    const dialog = screen.getByRole("alertdialog", { name: /Скрыть статью/ });
    expect(dialog.textContent).toMatch(/Скрыть/);
    expect(dialog.textContent).not.toMatch(/Удалить/);
    const confirm = within(dialog).getByRole("button", { name: "Скрыть" });
    await user.click(confirm);
    expect(hide).toHaveBeenCalledTimes(1);
    await user.click(confirm);
    expect(hide).toHaveBeenCalledTimes(1);
    resolveHide({ article: {} });
  });

  it("keeps mutation errors as a safe alert without a stack", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    hide.mockRejectedValue(new Error("boom stack"));
    render(
      <ArticleActionsMenu
        articleId="a1"
        title="Регламент"
        slug="reglament"
        status="published"
        revision={2}
        actions={actionsForStatus("published")}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Скрыть" }));
    const dialog = screen.getByRole("alertdialog", { name: /Скрыть статью/ });
    await user.click(within(dialog).getByRole("button", { name: "Скрыть" }));
    expect(alertSpy).toHaveBeenCalledWith("Ошибка операции");
    alertSpy.mockRestore();
  });
});
