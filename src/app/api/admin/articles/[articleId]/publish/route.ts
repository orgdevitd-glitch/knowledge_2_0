import { NotFoundError } from "@/domain/shared/errors";
import { assertArticlePublishable } from "@/domain/content/article";
import { UserId } from "@/domain/shared/ids";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  adminPublishLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";
import { publishBodySchema } from "@/features/admin/articles/schemas/mutation-schemas";
import { toAdminArticleDto } from "@/features/admin/articles/admin-article-dto";
import { publishArticleAndIndex } from "@/features/search/application/content-search-orchestration";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ articleId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { articleId } = await params;
  return runAdminMutation({
    request,
    limiter: adminPublishLimiter,
    schema: publishBodySchema,
    maxBodyBytes: 16_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const actorId = UserId.parse(principal.uid);
      const existing = await ports.articles.getById(articleId);
      if (!existing) {
        throw new NotFoundError("Article not found", { articleId });
      }
      assertArticlePublishable(existing);
      const result = await publishArticleAndIndex(
        ports,
        { actorId: actorId as string, requestId },
        articleId,
        data.expectedRevision,
        data.changeSummary,
      );
      return okJson({
        article: toAdminArticleDto(result.article),
        versionId: result.versionId,
      });
    },
  });
}
