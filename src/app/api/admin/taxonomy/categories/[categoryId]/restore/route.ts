import { UserId } from "@/domain/shared/ids";
import { restoreCategoryUseCase } from "@/features/content/application/taxonomy-use-cases";
import { revisionOnlyBodySchema } from "@/features/admin/taxonomy/schemas/mutation-schemas";
import { invalidateTaxonomyPublicCaches } from "@/features/admin/taxonomy/application/invalidate-taxonomy";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  okJson,
  runAdminMutation,
  taxonomyRestoreLimiter,
} from "@/server/http/admin-mutation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ categoryId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { categoryId } = await params;
  return runAdminMutation({
    request,
    limiter: taxonomyRestoreLimiter,
    schema: revisionOnlyBodySchema,
    maxBodyBytes: 4_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const category = await restoreCategoryUseCase(
        ports,
        { actorId: UserId.parse(principal.uid) as string, requestId },
        categoryId,
        data.expectedRevision,
      );
      invalidateTaxonomyPublicCaches();
      return okJson({
        category: {
          id: category.id,
          status: category.status,
          revision: category.revision,
        },
      });
    },
  });
}
