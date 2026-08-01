import { FixedClock } from "@/domain/shared/clock";
import { SequentialIdGenerator } from "@/domain/shared/id-generator";
import { parseIsoDateTime } from "@/domain/shared/value-objects";
import { richTextFromPlain } from "@/domain/shared/rich-text";
import { BLOCK_SCHEMA_VERSION, type ContentBlock } from "@/domain/content/blocks";
import type { ContentPorts } from "@/features/content/application/ports";
import { InProcessUnitOfWork } from "@/server/repositories/interfaces/unit-of-work";
import {
  MemoryArticleRepository,
  MemoryAudienceRepository,
  MemoryAuditRepository,
  MemoryCategoryRepository,
  MemoryPromptRepository,
  MemoryTagRepository,
  MemoryVersionRepository,
  MemoryVideoRepository,
} from "@/server/repositories/memory";

export const TEST_NOW = parseIsoDateTime("2024-06-15T12:00:00.000Z");

export function createTestPorts(): ContentPorts & {
  auditRepo: MemoryAuditRepository;
  articleRepo: MemoryArticleRepository;
  versionRepo: MemoryVersionRepository;
} {
  const articleRepo = new MemoryArticleRepository();
  const auditRepo = new MemoryAuditRepository();
  const versionRepo = new MemoryVersionRepository();
  return {
    articles: articleRepo,
    prompts: new MemoryPromptRepository(),
    videos: new MemoryVideoRepository(),
    categories: new MemoryCategoryRepository(),
    tags: new MemoryTagRepository(),
    audiences: new MemoryAudienceRepository(),
    versions: versionRepo,
    audit: auditRepo,
    clock: new FixedClock(TEST_NOW),
    ids: new SequentialIdGenerator(),
    uow: new InProcessUnitOfWork(),
    auditRepo,
    articleRepo,
    versionRepo,
  };
}

export function testCtx(overrides: Partial<{ actorId: string; requestId: string; now: string }> = {}) {
  return {
    actorId: overrides.actorId ?? "user_1",
    requestId: overrides.requestId ?? "req_1",
    now: overrides.now ?? TEST_NOW,
  };
}

export function paragraphBlock(
  id: string,
  text = "Sample paragraph",
): ContentBlock {
  return {
    id,
    type: "paragraph",
    schemaVersion: BLOCK_SCHEMA_VERSION,
    settings: {},
    visibility: "all",
    data: { content: richTextFromPlain(text) },
  };
}

export function headingBlock(id: string, text = "Section"): ContentBlock {
  return {
    id,
    type: "heading",
    schemaVersion: BLOCK_SCHEMA_VERSION,
    settings: {},
    visibility: "all",
    data: { level: 2, text },
  };
}

export function blockFixture(
  type: ContentBlock["type"],
  id: string,
  data: Record<string, unknown>,
): unknown {
  return {
    id,
    type,
    schemaVersion: BLOCK_SCHEMA_VERSION,
    settings: {},
    visibility: "all",
    data,
  };
}
