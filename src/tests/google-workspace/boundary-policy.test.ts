import { describe, expect, it, vi } from "vitest";

import { GoogleDriveBoundaryPolicy } from "@/server/google-workspace/drive/boundary-policy";
import { GoogleWorkspaceError } from "@/server/google-workspace/errors";
import { GOOGLE_DRIVE_MIME_TYPES } from "@/server/google-workspace/ports";
import {
  FakeGoogleDriveAdapter,
  type FakeDriveNode,
} from "@/server/google-workspace/testing/fake-drive";

const SHARED_DRIVE_ID = "shared-drive-1234567890";
const ROOT_FOLDER_ID = "root-folder-1234567890";

function buildPolicy(files: FakeDriveNode[]): GoogleDriveBoundaryPolicy {
  const drive = new FakeGoogleDriveAdapter(files);
  return new GoogleDriveBoundaryPolicy(drive, {
    sharedDriveId: SHARED_DRIVE_ID,
    rootFolderId: ROOT_FOLDER_ID,
    allowedFolderIds: [],
  });
}

function folder(
  id: string,
  parents: string[],
  children: string[] = [],
): FakeDriveNode {
  return {
    id,
    name: id,
    mimeType: GOOGLE_DRIVE_MIME_TYPES.folder,
    modifiedTime: "2026-01-01T00:00:00.000Z",
    createdTime: "2026-01-01T00:00:00.000Z",
    parents,
    driveId: SHARED_DRIVE_ID,
    trashed: false,
    size: null,
    version: "1",
    webViewLink: null,
    canDownload: false,
    children,
  };
}

function doc(id: string, parents: string[]): FakeDriveNode {
  return {
    id,
    name: `${id}.doc`,
    mimeType: GOOGLE_DRIVE_MIME_TYPES.document,
    modifiedTime: "2026-01-01T00:00:00.000Z",
    createdTime: "2026-01-01T00:00:00.000Z",
    parents,
    driveId: SHARED_DRIVE_ID,
    trashed: false,
    size: null,
    version: "1",
    webViewLink: null,
    canDownload: false,
  };
}

describe("GoogleDriveBoundaryPolicy", () => {
  it("allows file directly under root", async () => {
    const fileId = "doc-in-root-123456789";
    const policy = buildPolicy([
      folder(ROOT_FOLDER_ID, [], [fileId]),
      doc(fileId, [ROOT_FOLDER_ID]),
    ]);

    const metadata = await policy.verifyWithinAllowedBoundary(fileId);
    expect(metadata.id).toBe(fileId);
  });

  it("allows file in nested folder", async () => {
    const nestedFolderId = "nested-folder-123456789";
    const fileId = "doc-nested-1234567890";
    const policy = buildPolicy([
      folder(ROOT_FOLDER_ID, [], [nestedFolderId]),
      folder(nestedFolderId, [ROOT_FOLDER_ID], [fileId]),
      doc(fileId, [nestedFolderId]),
    ]);

    await expect(
      policy.verifyWithinAllowedBoundary(fileId),
    ).resolves.toMatchObject({ id: fileId });
  });

  it("rejects file outside root", async () => {
    const outsideFolderId = "outside-folder-123456789";
    const fileId = "doc-outside-1234567890";
    const policy = buildPolicy([
      folder(ROOT_FOLDER_ID, [], []),
      folder(outsideFolderId, [], [fileId]),
      doc(fileId, [outsideFolderId]),
    ]);

    await expect(policy.verifyWithinAllowedBoundary(fileId)).rejects.toMatchObject({
      code: "GOOGLE_FILE_OUTSIDE_ALLOWED_ROOT",
    });
  });

  it("rejects file in different shared drive", async () => {
    const fileId = "doc-other-drive-123456789";
    const policy = buildPolicy([
      folder(ROOT_FOLDER_ID, [], [fileId]),
      {
        ...doc(fileId, [ROOT_FOLDER_ID]),
        driveId: "other-shared-drive-1234567890",
      },
    ]);

    await expect(policy.verifyWithinAllowedBoundary(fileId)).rejects.toMatchObject({
      code: "GOOGLE_SHARED_DRIVE_MISMATCH",
    });
  });

  it("rejects trashed file", async () => {
    const fileId = "doc-trashed-1234567890";
    const policy = buildPolicy([
      folder(ROOT_FOLDER_ID, [], [fileId]),
      {
        ...doc(fileId, [ROOT_FOLDER_ID]),
        trashed: true,
      },
    ]);

    await expect(policy.verifyWithinAllowedBoundary(fileId)).rejects.toMatchObject({
      code: "GOOGLE_FILE_NOT_FOUND",
    });
  });

  it("detects folder hierarchy cycle", async () => {
    const folderA = "folder-a-1234567890";
    const folderB = "folder-b-1234567890";
    const fileId = "doc-cycle-1234567890";
    const policy = buildPolicy([
      folder(ROOT_FOLDER_ID, [], [folderA]),
      folder(folderA, [folderB], [fileId]),
      folder(folderB, [folderA], []),
      doc(fileId, [folderA]),
    ]);

    await expect(policy.verifyWithinAllowedBoundary(fileId)).rejects.toMatchObject({
      code: "GOOGLE_FILE_OUTSIDE_ALLOWED_ROOT",
    });
  });

  it("rejects when hierarchy exceeds max depth", async () => {
    const files: FakeDriveNode[] = [folder(ROOT_FOLDER_ID, [], [])];
    let previousId = "orphan-0-123456789012";
    files.push(folder(previousId, [], ["orphan-1-123456789012"]));

    for (let i = 1; i <= 45; i += 1) {
      const currentId = `orphan-${i}-123456789012`;
      const nextId =
        i === 45 ? "deep-doc-1234567890" : `orphan-${i + 1}-123456789012`;
      files.push(folder(currentId, [previousId], [nextId]));
      previousId = currentId;
    }

    files.push(doc("deep-doc-1234567890", ["orphan-45-123456789012"]));

    const policy = buildPolicy(files);
    await expect(
      policy.verifyWithinAllowedBoundary("deep-doc-1234567890"),
    ).rejects.toMatchObject({
      code: "GOOGLE_FILE_OUTSIDE_ALLOWED_ROOT",
    });
  });

  it("rejects unsupported mime type for import", async () => {
    const fileId = "pdf-in-root-1234567890";
    const policy = buildPolicy([
      folder(ROOT_FOLDER_ID, [], [fileId]),
      {
        ...doc(fileId, [ROOT_FOLDER_ID]),
        mimeType: "application/pdf",
      },
    ]);

    await expect(policy.verifyFileForImport(fileId)).rejects.toMatchObject({
      code: "GOOGLE_UNSUPPORTED_FILE_TYPE",
    });
  });

  it("uses request-scoped cache for repeated parent lookups", async () => {
    const nestedFolderId = "nested-folder-123456789";
    const fileId = "doc-nested-1234567890";
    const drive = new FakeGoogleDriveAdapter([
      folder(ROOT_FOLDER_ID, [], [nestedFolderId]),
      folder(nestedFolderId, [ROOT_FOLDER_ID], [fileId]),
      doc(fileId, [nestedFolderId]),
    ]);
    const getMetadataSpy = vi.spyOn(drive, "getFileMetadata");
    const policy = new GoogleDriveBoundaryPolicy(drive, {
      sharedDriveId: SHARED_DRIVE_ID,
      rootFolderId: ROOT_FOLDER_ID,
      allowedFolderIds: [],
    });

    await policy.verifyWithinAllowedBoundary(fileId);
    const callsAfterFirst = getMetadataSpy.mock.calls.length;
    await policy.verifyWithinAllowedBoundary(fileId);
    expect(getMetadataSpy.mock.calls.length).toBe(callsAfterFirst);
  });
});

describe("GoogleDriveBoundaryPolicy helpers", () => {
  it("isWithinAllowedBoundary returns false without throwing", async () => {
    const policy = buildPolicy([
      folder(ROOT_FOLDER_ID, [], []),
      doc("outside-doc-1234567890", ["outside-folder-123456789"]),
      folder("outside-folder-123456789", [], ["outside-doc-1234567890"]),
    ]);

    await expect(
      policy.isWithinAllowedBoundary("outside-doc-1234567890"),
    ).resolves.toBe(false);
  });

  it("verifyFolderForBrowse requires folder mime type", async () => {
    const fileId = "doc-in-root-123456789";
    const policy = buildPolicy([
      folder(ROOT_FOLDER_ID, [], [fileId]),
      doc(fileId, [ROOT_FOLDER_ID]),
    ]);

    await expect(policy.verifyFolderForBrowse(fileId)).rejects.toBeInstanceOf(
      GoogleWorkspaceError,
    );
  });
});
