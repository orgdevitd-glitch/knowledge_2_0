import { restoreArticleVersion } from "@/features/content/application/article-use-cases";
import { UserId } from "@/domain/shared/ids";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  adminRestoreLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";
import { restoreVersionBodySchema } from "@/features/admin/articles/schemas/mutation-schemas";
import { toAdminArticleDto } from "@/features/admin/articles/admin-article-dto";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ articleId: string; versionId: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const { articleId, versionId } = await params;
  return runAdminMutation({
    request,
    limiter: adminRestoreLimiter,
    schema: restoreVersionBodySchema,
    maxBodyBytes: 8_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const actorId = UserId.parse(principal.uid);
      const article = await restoreArticleVersion(
        ports,
        { actorId: actorId as string, requestId },
        articleId,
        versionId,
        data.expectedRevision,
      );
      return okJson({ article: toAdminArticleDto(article) });
    },
  });
}
