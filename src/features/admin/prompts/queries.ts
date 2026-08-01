import "server-only";

import type { SourceType } from "@/domain/content/source";
import { NotFoundError } from "@/domain/shared/errors";
import type { ContentStatus } from "@/domain/shared/status";
import {
  canPublishFromStatus,
  canTransitionStatus,
} from "@/domain/shared/status";
import type { AdminPrincipal } from "@/server/auth/principal";
import { getAdminPersistence } from "@/server/composition/admin-persistence";
import {
  getContentPorts,
  isContentPersistenceAvailable,
} from "@/server/composition/content-ports";

import { toAdminPromptDto, type AdminPromptDto } from "./admin-prompt-dto";

export type {
  AdminTaxonomyOption,
  AdminAuditSummary,
} from "@/features/admin/articles/queries";

export {
  listAdminTaxonomyOptions,
  listAdminTaxonomyOptionsForArticle as listAdminTaxonomyOptionsForPrompt,
} from "@/features/admin/articles/queries";

export type AdminVersionSummary = {
  id: string;
  versionNumber: number;
  createdAt: string;
  createdBy: string;
  changeSummary: string | null;
  isPublishedVersion: boolean;
};

export type AdminPromptActions = {
  canEdit: boolean;
  canPreview: boolean;
  canPublish: boolean;
  canHide: boolean;
  canArchive: boolean;
  canRestoreArchive: boolean;
  canViewVersions: boolean;
  canOpenPublic: boolean;
};

export type AdminPromptSourceSummary = {
  type: SourceType;
  externalId: string | null;
  connectionId: string | null;
  lastImportJobId: string | null;
  lastSyncAt: string | null;
  connectionStatus: string | null;
  label: string;
  warning: string | null;
};

const SOURCE_LABELS: Record<SourceType, string> = {
  portal: "Создан в портале",
  "google-docs": "Google Docs",
  "google-sheets": "Google Sheets",
  "google-drive": "Google Drive",
  "manual-import": "Ручной импорт",
};

export function buildPromptSourceSummary(
  prompt: AdminPromptDto,
  connection?: { status: string } | null,
): AdminPromptSourceSummary {
  const type = prompt.sourceType as SourceType;
  const connectionStatus = connection?.status ?? null;
  let warning: string | null = null;
  if (connectionStatus === "access-lost") {
    warning = "Источник недоступен (access-lost).";
  } else if (connectionStatus === "archived") {
    warning = "SourceConnection в архиве.";
  }
  return {
    type,
    externalId: prompt.sourceExternalId,
    connectionId: prompt.sourceConnectionId,
    lastImportJobId: prompt.sourceLastImportJobId,
    lastSyncAt: prompt.sourceLastSyncAt,
    connectionStatus,
    label: SOURCE_LABELS[type] ?? type,
    warning,
  };
}

export function actionsForStatus(status: ContentStatus): AdminPromptActions {
  return {
    canEdit: status !== "archived",
    canPreview: true,
    canPublish: canPublishFromStatus(status),
    canHide: canTransitionStatus(status, "hidden"),
    canArchive: canTransitionStatus(status, "archived"),
    canRestoreArchive:
      canTransitionStatus(status, "draft") && status === "archived",
    canViewVersions: true,
    canOpenPublic: status === "published",
  };
}

export async function getAdminPromptDetail(
  _principal: AdminPrincipal,
  promptId: string,
): Promise<{
  prompt: AdminPromptDto;
  source: AdminPromptSourceSummary;
  actions: AdminPromptActions;
  recentAudit: import("@/features/admin/articles/queries").AdminAuditSummary[];
} | null> {
  if (!isContentPersistenceAvailable()) return null;
  const ports = getContentPorts();
  const prompt = await ports.prompts.getById(promptId);
  if (!prompt) return null;
  const dto = toAdminPromptDto(prompt);
  const persistence = getAdminPersistence();
  let connection: { status: string } | null = null;
  if (dto.sourceConnectionId) {
    try {
      const { getIntegrationPorts } = await import(
        "@/server/composition/integration-ports"
      );
      const integration = await getIntegrationPorts();
      const conn = await integration.sources.getById(dto.sourceConnectionId);
      if (conn) connection = { status: conn.status };
    } catch {
      connection = null;
    }
  }
  const events = persistence.audit
    ? await persistence.audit.listByEntity("prompt", promptId)
    : [];
  const recentAudit = events
    .slice()
    .sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)))
    .slice(0, 20)
    .map((e) => ({
      id: e.id as string,
      eventType: e.eventType,
      occurredAt: e.occurredAt as string,
      actorId: e.actorId as string,
      changeSummary:
        typeof e.metadata?.changeSummary === "string"
          ? e.metadata.changeSummary
          : null,
    }));
  return {
    prompt: dto,
    source: buildPromptSourceSummary(dto, connection),
    actions: actionsForStatus(prompt.status),
    recentAudit,
  };
}

export async function listAdminPromptVersions(
  _principal: AdminPrincipal,
  promptId: string,
  page = 1,
  pageSize = 20,
): Promise<{
  promptTitle: string;
  publishedVersion: string | null;
  items: AdminVersionSummary[];
  total: number;
  page: number;
  totalPages: number;
} | null> {
  if (!isContentPersistenceAvailable()) return null;
  const ports = getContentPorts();
  const prompt = await ports.prompts.getById(promptId);
  if (!prompt) return null;
  const versions = await ports.versions.listByEntity("prompt", promptId);
  const sorted = versions
    .slice()
    .sort((a, b) => b.versionNumber - a.versionNumber);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const publishedVersion = prompt.publishedVersion
    ? String(prompt.publishedVersion)
    : null;
  return {
    promptTitle: prompt.title as string,
    publishedVersion,
    items: sorted.slice(start, start + pageSize).map((v) => ({
      id: v.id as string,
      versionNumber: v.versionNumber as number,
      createdAt: v.createdAt as string,
      createdBy: v.createdBy as string,
      changeSummary: v.changeSummary,
      isPublishedVersion: publishedVersion === String(v.id),
    })),
    total,
    page: safePage,
    totalPages,
  };
}

export async function getAdminPromptVersionDetail(
  _principal: AdminPrincipal,
  promptId: string,
  versionId: string,
) {
  if (!isContentPersistenceAvailable()) return null;
  const ports = getContentPorts();
  const prompt = await ports.prompts.getById(promptId);
  if (!prompt) return null;
  const version = await ports.versions.getById(versionId);
  if (
    !version ||
    version.entityType !== "prompt" ||
    version.entityId !== promptId
  ) {
    return null;
  }
  return {
    prompt: toAdminPromptDto(prompt),
    version: {
      id: version.id as string,
      versionNumber: version.versionNumber as number,
      createdAt: version.createdAt as string,
      createdBy: version.createdBy as string,
      changeSummary: version.changeSummary,
      snapshot: version.snapshot,
      isPublishedVersion:
        prompt.publishedVersion != null &&
        String(prompt.publishedVersion) === String(version.id),
    },
    actions: actionsForStatus(prompt.status),
  };
}

export async function requireAdminPrompt(
  principal: AdminPrincipal,
  promptId: string,
): Promise<AdminPromptDto> {
  const detail = await getAdminPromptDetail(principal, promptId);
  if (!detail) {
    throw new NotFoundError("Prompt not found", { promptId });
  }
  return detail.prompt;
}
