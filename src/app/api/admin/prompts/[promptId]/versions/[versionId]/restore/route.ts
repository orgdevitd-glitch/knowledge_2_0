import { restorePromptVersion } from "@/features/content/application/prompt-use-cases";
import { UserId } from "@/domain/shared/ids";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  adminRestoreLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";
import { restoreVersionBodySchema } from "@/features/admin/prompts/schemas/mutation-schemas";
import { toAdminPromptDto } from "@/features/admin/prompts/admin-prompt-dto";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ promptId: string; versionId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { promptId, versionId } = await params;
  return runAdminMutation({
    request,
    limiter: adminRestoreLimiter,
    schema: restoreVersionBodySchema,
    maxBodyBytes: 16_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const actorId = UserId.parse(principal.uid);
      const prompt = await restorePromptVersion(
        ports,
        { actorId: actorId as string, requestId },
        promptId,
        versionId,
        data.expectedRevision,
      );
      return okJson({ prompt: toAdminPromptDto(prompt) });
    },
  });
}
