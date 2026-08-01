import { updateMediaMetadata } from "@/features/content/application/media-use-cases";
import { UserId } from "@/domain/shared/ids";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  adminMediaMutationLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";
import { updateMediaBodySchema } from "@/features/admin/media/schemas/mutation-schemas";
import { toAdminMediaDto } from "@/features/admin/media/admin-media-dto";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ mediaId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { mediaId } = await params;
  return runAdminMutation({
    request,
    limiter: adminMediaMutationLimiter,
    schema: updateMediaBodySchema,
    maxBodyBytes: 32_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const media = await updateMediaMetadata(
        ports,
        {
          actorId: UserId.parse(principal.uid) as string,
          requestId,
        },
        mediaId,
        data.expectedRevision,
        {
          title: data.title,
          description: data.description,
          defaultAltText: data.defaultAltText,
        },
      );
      return okJson({ media: toAdminMediaDto(media) });
    },
  });
}
