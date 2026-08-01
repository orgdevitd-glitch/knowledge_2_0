import { createPromptUseCase } from "@/features/content/application/prompt-use-cases";
import { UserId } from "@/domain/shared/ids";
import { getContentPorts } from "@/server/composition/content-ports";
import {
  adminCreateLimiter,
  okJson,
  runAdminMutation,
} from "@/server/http/admin-mutation";
import { createPromptBodySchema } from "@/features/admin/prompts/schemas/mutation-schemas";
import { toAdminPromptDto } from "@/features/admin/prompts/admin-prompt-dto";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return runAdminMutation({
    request,
    limiter: adminCreateLimiter,
    schema: createPromptBodySchema,
    maxBodyBytes: 128_000,
    async handler({ principal, requestId, data }) {
      const ports = getContentPorts();
      const actorId = UserId.parse(principal.uid);
      const prompt = await createPromptUseCase(
        ports,
        { actorId: actorId as string, requestId },
        {
          title: data.title,
          slug: data.slug,
          summary: data.summary ?? null,
          promptText: data.promptText,
          inputRequirements: data.inputRequirements ?? null,
          outputRequirements: data.outputRequirements ?? null,
          restrictions: data.restrictions ?? null,
          usageExample: data.usageExample ?? null,
          categoryIds: data.categoryIds,
          tagIds: data.tagIds,
          audienceIds: data.audienceIds,
          reviewDueAt: data.reviewDueAt ?? null,
          ownerId: actorId as string,
        },
      );
      return okJson({ prompt: toAdminPromptDto(prompt) }, 201);
    },
  });
}
