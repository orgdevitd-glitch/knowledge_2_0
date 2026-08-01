import {
  createArticleUseCase,
} from "@/features/content/application/article-use-cases";
import { UserId } from "@/domain/shared/ids";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  adminCreateLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";
import { createArticleBodySchema } from "@/features/admin/articles/schemas/mutation-schemas";
import { toAdminArticleDto } from "@/features/admin/articles/admin-article-dto";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return runAdminMutation({
    request,
    limiter: adminCreateLimiter,
    schema: createArticleBodySchema,
    maxBodyBytes: 64_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const actorId = UserId.parse(principal.uid);
      const article = await createArticleUseCase(
        ports,
        { actorId: actorId as string, requestId },
        {
          title: data.title,
          slug: data.slug,
          summary: data.summary ?? null,
          categoryIds: data.categoryIds,
          tagIds: data.tagIds,
          audienceIds: data.audienceIds,
          reviewDueAt: data.reviewDueAt ?? null,
          ownerId: actorId as string,
          authorId: actorId as string,
          blocks: [],
        },
      );
      return okJson({ article: toAdminArticleDto(article) }, 201);
    },
  });
}
