import { replaceArticleBlocks } from "@/features/content/application/article-use-cases";
import { UserId } from "@/domain/shared/ids";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  adminSaveLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";
import { updateBlocksBodySchema } from "@/features/admin/articles/schemas/mutation-schemas";
import { toAdminArticleDto } from "@/features/admin/articles/admin-article-dto";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ articleId: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { articleId } = await params;
  return runAdminMutation({
    request,
    limiter: adminSaveLimiter,
    schema: updateBlocksBodySchema,
    maxBodyBytes: 512_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const actorId = UserId.parse(principal.uid);
      const article = await replaceArticleBlocks(
        ports,
        { actorId: actorId as string, requestId },
        articleId,
        data.expectedRevision,
        data.blocks,
      );
      return okJson({ article: toAdminArticleDto(article) });
    },
  });
}
