import {
  updateArticleMetadata,
} from "@/features/content/application/article-use-cases";
import { UserId } from "@/domain/shared/ids";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  adminSaveLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";
import { updateMetadataBodySchema } from "@/features/admin/articles/schemas/mutation-schemas";
import { toAdminArticleDto } from "@/features/admin/articles/admin-article-dto";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ articleId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { articleId } = await params;
  return runAdminMutation({
    request,
    limiter: adminSaveLimiter,
    schema: updateMetadataBodySchema,
    maxBodyBytes: 64_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const actorId = UserId.parse(principal.uid);
      const { csrfToken: _c, expectedRevision, ...patch } = data;
      void _c;
      const article = await updateArticleMetadata(
        ports,
        { actorId: actorId as string, requestId },
        articleId,
        expectedRevision,
        patch,
      );
      return okJson({ article: toAdminArticleDto(article) });
    },
  });
}
