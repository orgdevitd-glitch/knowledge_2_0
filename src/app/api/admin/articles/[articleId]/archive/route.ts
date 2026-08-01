import { archiveArticle } from "@/features/content/application/article-use-cases";
import { UserId } from "@/domain/shared/ids";
import { getContentPorts } from "@/server/composition/content-ports";
import { getPublicContentInvalidation } from "@/server/content/public-invalidation";
import {
  adminPublishLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";
import { revisionOnlyBodySchema } from "@/features/admin/articles/schemas/mutation-schemas";
import { toAdminArticleDto } from "@/features/admin/articles/admin-article-dto";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ articleId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { articleId } = await params;
  return runAdminMutation({
    request,
    limiter: adminPublishLimiter,
    schema: revisionOnlyBodySchema,
    maxBodyBytes: 8_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const actorId = UserId.parse(principal.uid);
      const article = await archiveArticle(
        ports,
        { actorId: actorId as string, requestId },
        articleId,
        data.expectedRevision,
      );
      getPublicContentInvalidation().invalidateArticle({
        slug: article.slug as string,
      });
      return okJson({ article: toAdminArticleDto(article) });
    },
  });
}
