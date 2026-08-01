import { GoogleDriveBoundaryPolicy } from "@/server/google-workspace/drive/boundary-policy";
import { GOOGLE_WORKSPACE_LIMITS } from "@/server/google-workspace/limits";
import { getIntegrationPorts } from "@/server/composition/integration-ports";
import { assertGoogleEnabled, runAdminGet } from "@/server/http/admin-get";
import {
  googleDriveBrowseLimiter,
  okJson,
} from "@/server/http/admin-mutation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ folderId: string }> };

export async function GET(request: Request, { params }: Params) {
  const { folderId } = await params;
  const url = new URL(request.url);
  const pageToken = url.searchParams.get("pageToken") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;

  return runAdminGet({
    limiter: googleDriveBrowseLimiter,
    async handler() {
      assertGoogleEnabled();
      const ports = await getIntegrationPorts();
      const policy = new GoogleDriveBoundaryPolicy(
        ports.google.drive,
        ports.config,
      );
      const resolvedId =
        folderId === "root" ? ports.config.rootFolderId : folderId;
      await policy.verifyFolderForBrowse(resolvedId);
      const page = await ports.google.drive.listFolderChildren(resolvedId, {
        pageToken,
        pageSize: GOOGLE_WORKSPACE_LIMITS.MAX_DRIVE_PAGE_SIZE,
        query: q,
      });
      const parent = await ports.google.drive.getFileMetadata(resolvedId);
      const parentCandidate = parent.parents[0] ?? null;
      const canGoUp =
        resolvedId !== ports.config.rootFolderId &&
        parentCandidate !== null &&
        (await policy.isWithinAllowedBoundary(parentCandidate));

      return okJson({
        folderId: resolvedId,
        folderName: parent.name,
        parentId: canGoUp ? parentCandidate : null,
        canGoUp,
        rootFolderId: ports.config.rootFolderId,
        items: page.items.map((item) => ({
          id: item.id,
          name: item.name,
          mimeType: item.mimeType,
          modifiedTime: item.modifiedTime,
          supported:
            item.mimeType === "application/vnd.google-apps.document" ||
            item.mimeType === "application/vnd.google-apps.spreadsheet" ||
            item.mimeType === "application/vnd.google-apps.folder",
        })),
        nextPageToken: page.nextPageToken,
      });
    },
  });
}
