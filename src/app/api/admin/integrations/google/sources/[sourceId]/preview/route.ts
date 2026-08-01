import {
  createDocsImportPreview,
  createSheetsImportPreview,
} from "@/features/integrations/google/application/create-import-preview";
import { previewSourceBodySchema } from "@/features/integrations/google/schemas";
import { getIntegrationPorts } from "@/server/composition/integration-ports";
import { assertGoogleEnabled } from "@/server/http/admin-get";
import {
  googlePreviewLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";
import { GOOGLE_DRIVE_MIME_TYPES } from "@/server/google-workspace/ports";
import { NotFoundError } from "@/domain/shared/errors";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ sourceId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { sourceId } = await params;
  return runAdminMutation({
    request,
    limiter: googlePreviewLimiter,
    schema: previewSourceBodySchema,
    maxBodyBytes: 16_000,
    async handler({ principal, requestId, data }) {
      assertGoogleEnabled();
      const ports = await getIntegrationPorts();
      const source = await ports.sources.getById(sourceId);
      if (!source) {
        throw new NotFoundError("Source connection not found", { sourceId });
      }
      const job =
        source.mimeType === GOOGLE_DRIVE_MIME_TYPES.document
          ? await createDocsImportPreview(ports, {
              actorId: principal.uid,
              requestId,
              sourceId,
              targetArticleId: data.targetArticleId ?? null,
            })
          : await createSheetsImportPreview(ports, {
              actorId: principal.uid,
              requestId,
              sourceId,
              dataSheetName: data.dataSheetName,
            });
      return okJson({ importJob: job }, 201);
    },
  });
}
