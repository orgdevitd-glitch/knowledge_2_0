import { InvalidStatusTransitionError } from "./errors";

export const CONTENT_STATUSES = [
  "draft",
  "published",
  "hidden",
  "archived",
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<ContentStatus, readonly ContentStatus[]> = {
  draft: ["published", "archived"],
  published: ["hidden", "archived"],
  hidden: ["published", "archived"],
  archived: ["draft"],
};

export function canTransitionStatus(
  from: ContentStatus,
  to: ContentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** True when entity may create a new published version. */
export function canPublishFromStatus(status: ContentStatus): boolean {
  return status === "published" || canTransitionStatus(status, "published");
}

export function assertStatusTransition(
  from: ContentStatus,
  to: ContentStatus,
): void {
  if (!canTransitionStatus(from, to)) {
    throw new InvalidStatusTransitionError(
      `Status transition ${from} -> ${to} is not allowed`,
      { from, to, allowed: [...ALLOWED_TRANSITIONS[from]] },
    );
  }
}

export type TaxonomyStatus = "active" | "archived";
