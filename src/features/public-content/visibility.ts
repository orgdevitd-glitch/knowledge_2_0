import type { ContentStatus } from "@/domain/shared/status";

/** Centralized public visibility: only published materials are readable. */
export function isPubliclyVisible(status: ContentStatus): boolean {
  return status === "published";
}

export function filterPublished<T extends { status: ContentStatus }>(
  items: readonly T[],
): T[] {
  return items.filter((item) => isPubliclyVisible(item.status));
}
