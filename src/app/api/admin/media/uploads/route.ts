import { startMediaUpload } from "@/features/content/application/media-use-cases";
import { UserId } from "@/domain/shared/ids";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  adminMediaUploadLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";
import { startMediaUploadBodySchema } from "@/features/admin/media/schemas/mutation-schemas";
import { toAdminMediaDto } from "@/features/admin/media/admin-media-dto";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return runAdminMutation({
    request,
    limiter: adminMediaUploadLimiter,
    schema: startMediaUploadBodySchema,
    maxBodyBytes: 32_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const result = await startMediaUpload(
        ports,
        {
          actorId: UserId.parse(principal.uid) as string,
          requestId,
        },
        {
          kind: data.kind,
          title: data.title,
          description: data.description,
          defaultAltText: data.defaultAltText,
          originalFileName: data.originalFileName,
          declaredSizeBytes: data.declaredSizeBytes,
        },
      );
      return okJson({
        media: toAdminMediaDto(result.media),
        uploadUrl: result.uploadUrl,
        expiresAt: result.expiresAt,
        requiredHeaders: result.requiredHeaders,
      });
    },
  });
}
