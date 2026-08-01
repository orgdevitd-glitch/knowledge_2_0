import { restoreMedia } from "@/features/content/application/media-use-cases";
import { UserId } from "@/domain/shared/ids";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  adminMediaMutationLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";
import { revisionOnlyMediaBodySchema } from "@/features/admin/media/schemas/mutation-schemas";
import { toAdminMediaDto } from "@/features/admin/media/admin-media-dto";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ mediaId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { mediaId } = await params;
  return runAdminMutation({
    request,
    limiter: adminMediaMutationLimiter,
    schema: revisionOnlyMediaBodySchema,
    maxBodyBytes: 16_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const media = await restoreMedia(
        ports,
        {
          actorId: UserId.parse(principal.uid) as string,
          requestId,
        },
        mediaId,
        data.expectedRevision,
      );
      return okJson({ media: toAdminMediaDto(media) });
    },
  });
}
