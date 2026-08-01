import { z } from "zod";

import { TaxonomyUsageService } from "@/features/admin/taxonomy/application/taxonomy-usage-service";
import { taxonomyTypeSchema } from "@/features/admin/taxonomy/schemas/mutation-schemas";
import { getContentPorts } from "@/server/composition/content-ports";
import { runAdminGet } from "@/server/http/admin-get";
import { okJson, taxonomyUsageLimiter } from "@/server/http/admin-mutation";
import { NotFoundError, ValidationError } from "@/domain/shared/errors";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ taxonomyType: string; taxonomyId: string }>;
};

export async function GET(request: Request, { params }: Params) {
  const { taxonomyType, taxonomyId } = await params;
  return runAdminGet({
    limiter: taxonomyUsageLimiter,
    async handler() {
      const parsedType = taxonomyTypeSchema.safeParse(taxonomyType);
      if (!parsedType.success) {
        throw new ValidationError("Unknown taxonomy type", {
          adminCode: "VALIDATION_ERROR",
          taxonomyType,
        });
      }
      const url = new URL(request.url);
      const limit = z.coerce
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .parse(url.searchParams.get("limit") ?? undefined);
      const cursor = url.searchParams.get("cursor");

      const ports = getContentPorts();
      const kind = parsedType.data;
      const exists =
        kind === "category"
          ? await ports.categories.getById(taxonomyId)
          : kind === "tag"
            ? await ports.tags.getById(taxonomyId)
            : await ports.audiences.getById(taxonomyId);
      if (!exists) {
        throw new NotFoundError("Taxonomy value not found", { taxonomyId });
      }

      const page = await new TaxonomyUsageService(ports).listUsage(
        kind,
        taxonomyId,
        { limit, cursor },
      );
      return okJson({
        summary: page.summary,
        items: page.items,
        nextCursor: page.nextCursor,
        limit: page.limit,
      });
    },
  });
}
