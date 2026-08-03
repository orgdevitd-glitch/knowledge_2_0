import { assertPromptPublishable } from "@/domain/content/prompt";
import { NotFoundError } from "@/domain/shared/errors";
import { UserId } from "@/domain/shared/ids";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  adminPublishLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";
import { publishBodySchema } from "@/features/admin/prompts/schemas/mutation-schemas";
import { toAdminPromptDto } from "@/features/admin/prompts/admin-prompt-dto";
import { publishPromptAndIndex } from "@/features/search/application/content-search-orchestration";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ promptId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { promptId } = await params;
  return runAdminMutation({
    request,
    limiter: adminPublishLimiter,
    schema: publishBodySchema,
    maxBodyBytes: 16_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const actorId = UserId.parse(principal.uid);
      const existing = await ports.prompts.getById(promptId);
      if (!existing) {
        throw new NotFoundError("Prompt not found", { promptId });
      }
      assertPromptPublishable(existing);
      const result = await publishPromptAndIndex(
        ports,
        { actorId: actorId as string, requestId },
        promptId,
        data.expectedRevision,
        data.changeSummary,
      );
      return okJson({
        prompt: toAdminPromptDto(result.prompt),
        versionId: result.versionId,
      });
    },
  });
}
