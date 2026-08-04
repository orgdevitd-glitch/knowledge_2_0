import { createHash } from "node:crypto";

import type { AssistantEntityType } from "./types";

/** Deterministic chunk identity — Node crypto only, no extra dependency. */
export function buildAssistantChunkId(input: {
  entityType: AssistantEntityType;
  entityId: string;
  versionId: string;
  ordinal: number;
  headingPath: string;
  sectionIdentity: string;
}): string {
  const material = [
    input.entityType,
    input.entityId,
    input.versionId,
    String(input.ordinal),
    input.headingPath,
    input.sectionIdentity,
  ].join("|");
  return createHash("sha256").update(material, "utf8").digest("hex").slice(0, 24);
}

export function buildAssistantSourceId(
  entityType: AssistantEntityType,
  entityId: string,
  versionId: string,
): string {
  return createHash("sha256")
    .update(`${entityType}|${entityId}|${versionId}`, "utf8")
    .digest("hex")
    .slice(0, 20);
}
