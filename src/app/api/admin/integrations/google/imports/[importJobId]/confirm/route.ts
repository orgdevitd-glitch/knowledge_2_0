import {
  confirmDocsImport,
  confirmSheetsImport,
} from "@/features/integrations/google/application/confirm-import";
import { confirmImportBodySchema } from "@/features/integrations/google/schemas";
import { getIntegrationPorts } from "@/server/composition/integration-ports";
import { assertGoogleEnabled } from "@/server/http/admin-get";
import {
  googleConfirmLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";
import { NotFoundError } from "@/domain/shared/errors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ importJobId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { importJobId } = await params;
  return runAdminMutation({
    request,
    limiter: googleConfirmLimiter,
    schema: confirmImportBodySchema,
    maxBodyBytes: 32_000,
    async handler({ principal, requestId, data }) {
      assertGoogleEnabled();
      const ports = await getIntegrationPorts();
      const job = await ports.importJobs.getById(importJobId);
      if (!job) {
        throw new NotFoundError("Import job not found", { importJobId });
      }
      if (job.importType === "google-docs-article") {
        const result = await confirmDocsImport(ports, {
          actorId: principal.uid,
          requestId,
          importJobId,
          mode: data.mode ?? "both",
          createNew: data.createNew ?? !job.targetEntityId,
          targetArticleId: data.targetArticleId ?? job.targetEntityId,
          title: data.title,
          slug: data.slug,
          summary: data.summary,
        });
        return okJson(result);
      }
      const result = await confirmSheetsImport(ports, {
        actorId: principal.uid,
        requestId,
        importJobId,
        readyOnly: data.readyOnly ?? false,
      });
      return okJson(result);
    },
  });
}
