import "server-only";

import type { MediaKind, MediaStatus } from "@/domain/content/media";
import { MEDIA_KIND_VALUES, MEDIA_LIMIT_DEFAULTS, MEDIA_STATUS_VALUES } from "@/domain/shared/media-limits";
import type { AdminPrincipal } from "@/server/auth/principal";
import { getAdminPersistence } from "@/server/composition/admin-persistence";
import { getContentPorts } from "@/server/composition/content-ports";

import { toAdminMediaDto } from "./admin-media-dto";

export type AdminMediaSummary = {
  id: string;
  title: string;
  kind: string;
  status: string;
  mimeType: string | null;
  originalFileName: string;
  sizeBytes: number | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  publicPath: string | null;
};

export type AdminMediaPage = {
  items: AdminMediaSummary[];
  nextCursor: string | null;
  limit: number;
  scanLimitExceeded: boolean;
  persistenceMode: "memory" | "firestore" | "unavailable";
};

export async function listAdminMedia(
  _principal: AdminPrincipal,
  input: {
    status?: string | null;
    kind?: string | null;
    q?: string | null;
    cursor?: string | null;
    limit?: string | number | null;
  },
): Promise<AdminMediaPage> {
  const persistence = getAdminPersistence();
  if (persistence.mode === "unavailable") {
    return {
      items: [],
      nextCursor: null,
      limit: MEDIA_LIMIT_DEFAULTS.adminPageDefault,
      scanLimitExceeded: false,
      persistenceMode: "unavailable",
    };
  }

  const ports = getContentPorts();
  if (!ports.media) {
    return {
      items: [],
      nextCursor: null,
      limit: MEDIA_LIMIT_DEFAULTS.adminPageDefault,
      scanLimitExceeded: false,
      persistenceMode: persistence.mode,
    };
  }

  const limitRaw = Number.parseInt(
    String(input.limit ?? MEDIA_LIMIT_DEFAULTS.adminPageDefault),
    10,
  );
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, MEDIA_LIMIT_DEFAULTS.adminPageMax)
      : MEDIA_LIMIT_DEFAULTS.adminPageDefault;

  const status =
    input.status &&
    (MEDIA_STATUS_VALUES as readonly string[]).includes(input.status)
      ? (input.status as MediaStatus)
      : undefined;

  const kind =
    input.kind && (MEDIA_KIND_VALUES as readonly string[]).includes(input.kind)
      ? (input.kind as MediaKind)
      : undefined;

  const page = await ports.media.listAdmin(
    {
      status,
      kind,
      q: input.q?.trim() || undefined,
      sort: "updatedAt_desc",
    },
    { limit, cursor: input.cursor ?? null },
  );

  return {
    items: page.items.map((media) => {
      const dto = toAdminMediaDto(media);
      return {
        id: dto.id,
        title: dto.title,
        kind: dto.kind,
        status: dto.status,
        mimeType: dto.mimeType,
        originalFileName: dto.originalFileName,
        sizeBytes: dto.sizeBytes,
        revision: dto.revision,
        createdAt: dto.createdAt,
        updatedAt: dto.updatedAt,
        publicPath: dto.publicPath,
      };
    }),
    nextCursor: page.nextCursor,
    limit: page.limit,
    scanLimitExceeded: page.scanLimitExceeded,
    persistenceMode: persistence.mode,
  };
}
