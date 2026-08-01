import "server-only";

import type { Prompt } from "@/domain/content/prompt";
import type { ContentStatus } from "@/domain/shared/status";

/** Safe admin prompt DTO for API / editor (no secrets, no checksum). */
export type AdminPromptDto = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  promptText: string;
  inputRequirements: string | null;
  outputRequirements: string | null;
  restrictions: string | null;
  usageExample: string | null;
  categoryIds: string[];
  tagIds: string[];
  audienceIds: string[];
  reviewDueAt: string | null;
  sourceType: string;
  sourceExternalId: string | null;
  sourceConnectionId: string | null;
  sourceLastImportJobId: string | null;
  sourceLastSyncAt: string | null;
  status: ContentStatus;
  revision: number;
  publishedVersion: string | null;
  currentVersion: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  ownerId: string | null;
};

export function toAdminPromptDto(prompt: Prompt): AdminPromptDto {
  return {
    id: prompt.id as string,
    slug: prompt.slug as string,
    title: prompt.title as string,
    summary: (prompt.summary as string | null) ?? null,
    promptText: prompt.promptText,
    inputRequirements: prompt.inputRequirements,
    outputRequirements: prompt.outputRequirements,
    restrictions: prompt.restrictions,
    usageExample: prompt.usageExample,
    categoryIds: prompt.categoryIds.map(String),
    tagIds: prompt.tagIds.map(String),
    audienceIds: prompt.audienceIds.map(String),
    reviewDueAt: (prompt.reviewDueAt as string | null) ?? null,
    sourceType: prompt.source.type,
    sourceExternalId: prompt.source.externalId ?? null,
    sourceConnectionId: prompt.source.connectionId ?? null,
    sourceLastImportJobId: prompt.source.lastImportJobId ?? null,
    sourceLastSyncAt: prompt.source.lastSyncAt
      ? String(prompt.source.lastSyncAt)
      : null,
    status: prompt.status,
    revision: prompt.revision as number,
    publishedVersion: prompt.publishedVersion
      ? String(prompt.publishedVersion)
      : null,
    currentVersion: prompt.currentVersion
      ? String(prompt.currentVersion)
      : null,
    createdAt: prompt.createdAt as string,
    updatedAt: prompt.updatedAt as string,
    publishedAt: (prompt.publishedAt as string | null) ?? null,
    ownerId: prompt.ownerId ? String(prompt.ownerId) : null,
  };
}
