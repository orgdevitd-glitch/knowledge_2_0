import { getGoogleWorkspaceMode } from "@/config/env";
import { isGoogleWorkspaceEnabled } from "@/server/google-workspace/composition";
import { getIntegrationPorts } from "@/server/composition/integration-ports";
import { googleDisabledJson, runAdminGet } from "@/server/http/admin-get";
import { okJson } from "@/server/http/admin-mutation";

export const dynamic = "force-dynamic";

export async function GET() {
  return runAdminGet({
    async handler() {
      const mode = getGoogleWorkspaceMode();
      if (!isGoogleWorkspaceEnabled()) {
        return googleDisabledJson();
      }
      try {
        const ports = await getIntegrationPorts();
        const [sources, imports] = await Promise.all([
          ports.sources.listActive(50),
          ports.importJobs.listRecent(10),
        ]);
        return okJson({
          mode,
          available: true,
          sharedDriveConfigured: Boolean(ports.config.sharedDriveId),
          rootFolderConfigured: Boolean(ports.config.rootFolderId),
          activeSourceCount: sources.length,
          recentImports: imports.map((job) => ({
            id: job.id,
            status: job.status,
            importType: job.importType,
            createdAt: job.createdAt,
            errorCount: job.errors.length,
          })),
        });
      } catch {
        return okJson({
          mode,
          available: false,
          message: "Не удалось получить статус Google Workspace.",
        });
      }
    },
  });
}
