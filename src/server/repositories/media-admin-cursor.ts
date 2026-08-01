import { ValidationError } from "@/domain/shared/errors";
import type { MediaAdminSort } from "@/server/repositories/interfaces/media-repository";

export type MediaAdminCursorPayload = {
  sort: MediaAdminSort;
  v: string;
  id: string;
};

export function encodeMediaAdminCursor(
  payload: MediaAdminCursorPayload,
): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeMediaAdminCursor(
  cursor: string,
  expectedSort: MediaAdminSort,
): MediaAdminCursorPayload {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as MediaAdminCursorPayload;
    if (
      !parsed ||
      typeof parsed.v !== "string" ||
      typeof parsed.id !== "string" ||
      typeof parsed.sort !== "string"
    ) {
      throw new Error("shape");
    }
    if (parsed.sort !== expectedSort) {
      throw new ValidationError("Cursor sort mismatch", {
        adminCode: "VALIDATION_ERROR",
      });
    }
    if (!parsed.id.trim() || !parsed.v.trim()) {
      throw new Error("empty");
    }
    return parsed;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError("Malformed admin list cursor", {
      adminCode: "VALIDATION_ERROR",
    });
  }
}

export function sortValueForMedia(
  media: { id: string; updatedAt: string },
  sort: MediaAdminSort,
): string {
  if (sort === "updatedAt_desc") return media.updatedAt;
  return media.updatedAt;
}

export function compareMediaAdmin(
  a: { id: string; updatedAt: string },
  b: { id: string; updatedAt: string },
  sort: MediaAdminSort,
): number {
  if (sort === "updatedAt_desc") {
    const byUpdated = b.updatedAt.localeCompare(a.updatedAt);
    if (byUpdated !== 0) return byUpdated;
    return b.id.localeCompare(a.id);
  }
  const byUpdated = b.updatedAt.localeCompare(a.updatedAt);
  if (byUpdated !== 0) return byUpdated;
  return b.id.localeCompare(a.id);
}
