import "server-only";

import { randomUUID } from "node:crypto";

import type { ContentPorts } from "@/features/content/application/ports";
import { SystemClock } from "@/domain/shared/clock";
import type { IdGenerator } from "@/domain/shared/id-generator";
import { getAdminPersistence } from "@/server/composition/admin-persistence";
import { MemoryPromptRepository } from "@/server/repositories/memory/memory-prompt-repository";
import { MemoryVideoRepository } from "@/server/repositories/memory/memory-video-repository";
import { FirestorePromptRepository } from "@/server/repositories/firestore/firestore-prompt-repository";
import {
  InProcessUnitOfWork,
  type UnitOfWork,
} from "@/server/repositories/interfaces/unit-of-work";
import { FirestoreUnitOfWork } from "@/server/repositories/firestore/firestore-unit-of-work";
import { RepositoryError } from "@/domain/shared/errors";

class UuidIdGenerator implements IdGenerator {
  next(prefix = "id"): string {
    return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  }
}

/**
 * Builds ContentPorts for admin mutations.
 * Throws when persistence is unavailable (Firebase/Firestore not configured).
 */
export function getContentPorts(): ContentPorts {
  const persistence = getAdminPersistence();
  if (
    !persistence.articles ||
    !persistence.categories ||
    !persistence.tags ||
    !persistence.audiences ||
    !persistence.versions ||
    !persistence.audit
  ) {
    throw new RepositoryError("Content persistence is unavailable", {
      mode: persistence.mode,
    });
  }

  let uow: UnitOfWork;
  if (persistence.mode === "firestore") {
    uow = new FirestoreUnitOfWork();
  } else {
    uow = new InProcessUnitOfWork();
  }

  return {
    articles: persistence.articles,
    prompts:
      persistence.mode === "firestore"
        ? new FirestorePromptRepository()
        : new MemoryPromptRepository(),
    videos: new MemoryVideoRepository(),
    categories: persistence.categories,
    tags: persistence.tags,
    audiences: persistence.audiences,
    versions: persistence.versions,
    audit: persistence.audit,
    clock: new SystemClock(),
    ids: new UuidIdGenerator(),
    uow,
  };
}

export function isContentPersistenceAvailable(): boolean {
  const persistence = getAdminPersistence();
  return persistence.mode !== "unavailable" && persistence.articles !== null;
}
