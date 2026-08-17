/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MediaActions } from "@/features/admin/media/components/media-actions";
import type { AdminMediaDto } from "@/features/admin/media/admin-media-dto";
import { actionsForMediaStatus } from "@/features/admin/media/queries";

const archive = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/admin/media/client/admin-media-api", () => ({
  AdminMutationClientError: class extends Error {
    code = "INTERNAL_ERROR";
    fields = {};
    status = 500;
  },
  adminMediaApi: {
    archive: (...args: unknown[]) => archive(...args),
  },
  uploadMediaBinary: vi.fn(),
}));

const media: AdminMediaDto = {
  id: "media_1",
  title: "Hero",
  description: null,
  defaultAltText: null,
  kind: "image",
  mimeType: "image/jpeg",
  originalFileName: "hero.jpg",
  fileExtension: "jpg",
  sizeBytes: 10,
  width: 10,
  height: 10,
  status: "ready",
  sourceType: "upload",
  ownerId: "user_1",
  failureReasonCode: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  uploadedAt: "2026-01-01T00:00:00.000Z",
  archivedAt: null,
  revision: 2,
  publicPath: "/media/media_1",
};

describe("media archive confirmation", () => {
  afterEach(() => {
    cleanup();
  });
  beforeEach(() => {
    archive.mockReset();
    archive.mockResolvedValue({ media: {} });
  });

  it("does not archive on cancel and archives once while pending", async () => {
    const user = userEvent.setup();
    let resolveArchive: (value: unknown) => void = () => undefined;
    archive.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveArchive = resolve;
        }),
    );
    render(
      <MediaActions
        mediaId="media_1"
        media={media}
        actions={actionsForMediaStatus("ready")}
      />,
    );
    await user.click(screen.getByRole("button", { name: "В архив" }));
    const dialog = screen.getByRole("alertdialog", { name: /Архивировать медиа/ });
    await user.click(within(dialog).getByRole("button", { name: "Отмена" }));
    expect(archive).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "В архив" }));
    const confirmDialog = screen.getByRole("alertdialog", { name: /Архивировать медиа/ });
    const confirm = within(confirmDialog).getByRole("button", { name: "В архив" });
    await user.click(confirm);
    expect(archive).toHaveBeenCalledTimes(1);
    await user.click(confirm);
    expect(archive).toHaveBeenCalledTimes(1);
    resolveArchive({ media: {} });
  });
});
