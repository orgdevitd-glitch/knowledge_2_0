import { restoreArchivedPrompt } from "@/features/content/application/prompt-use-cases";
import { UserId } from "@/domain/shared/ids";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  adminRestoreLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";
import { revisionOnlyBodySchema } from "@/features/admin/prompts/schemas/mutation-schemas";
import { toAdminPromptDto } from "@/features/admin/prompts/admin-prompt-dto";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ promptId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { promptId } = await params;
  return runAdminMutation({
    request,
    limiter: adminRestoreLimiter,
    schema: revisionOnlyBodySchema,
    maxBodyBytes: 8_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const actorId = UserId.parse(principal.uid);
      const prompt = await restoreArchivedPrompt(
        ports,
        { actorId: actorId as string, requestId },
        promptId,
        data.expectedRevision,
      );
      return okJson({ prompt: toAdminPromptDto(prompt) });
    },
  });
}
