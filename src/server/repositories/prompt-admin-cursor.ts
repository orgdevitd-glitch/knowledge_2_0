import { ValidationError } from "@/domain/shared/errors";
import type { PromptAdminSort } from "@/server/repositories/interfaces/prompt-repository";

export type PromptAdminCursorPayload = {
  sort: PromptAdminSort;
  v: string;
  id: string;
};

export function encodePromptAdminCursor(
  payload: PromptAdminCursorPayload,
): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodePromptAdminCursor(
  cursor: string,
  expectedSort: PromptAdminSort,
): PromptAdminCursorPayload {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as PromptAdminCursorPayload;
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

export function sortValueForPrompt(
  prompt: { id: string; title: string; updatedAt: string; createdAt: string },
  sort: PromptAdminSort,
): string {
  if (sort === "title_asc") return prompt.title;
  if (sort === "createdAt_desc") return prompt.createdAt;
  return prompt.updatedAt;
}

export function comparePromptsAdmin(
  a: { id: string; title: string; updatedAt: string; createdAt: string },
  b: { id: string; title: string; updatedAt: string; createdAt: string },
  sort: PromptAdminSort,
): number {
  if (sort === "title_asc") {
    const byTitle = a.title.localeCompare(b.title, "ru");
    if (byTitle !== 0) return byTitle;
    return a.id.localeCompare(b.id);
  }
  if (sort === "createdAt_desc") {
    const byCreated = b.createdAt.localeCompare(a.createdAt);
    if (byCreated !== 0) return byCreated;
    return b.id.localeCompare(a.id);
  }
  const byUpdated = b.updatedAt.localeCompare(a.updatedAt);
  if (byUpdated !== 0) return byUpdated;
  return b.id.localeCompare(a.id);
}
