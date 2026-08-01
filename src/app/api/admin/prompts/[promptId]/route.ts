import { updatePrompt } from "@/features/content/application/prompt-use-cases";
import { UserId } from "@/domain/shared/ids";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  adminSaveLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";
import { updatePromptBodySchema } from "@/features/admin/prompts/schemas/mutation-schemas";
import { toAdminPromptDto } from "@/features/admin/prompts/admin-prompt-dto";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ promptId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { promptId } = await params;
  return runAdminMutation({
    request,
    limiter: adminSaveLimiter,
    schema: updatePromptBodySchema,
    maxBodyBytes: 256_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const actorId = UserId.parse(principal.uid);
      const { csrfToken: _c, expectedRevision, ...patch } = data;
      void _c;
      const prompt = await updatePrompt(
        ports,
        { actorId: actorId as string, requestId },
        promptId,
        expectedRevision,
        patch,
      );
      return okJson({ prompt: toAdminPromptDto(prompt) });
    },
  });
}
