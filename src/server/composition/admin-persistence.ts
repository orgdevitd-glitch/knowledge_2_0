import "server-only";

import {
  getPersistenceMode,
  getServerEnv,
} from "@/config/env";
import type { ArticleRepository } from "@/server/repositories/interfaces/article-repository";
import type {
  AudienceRepository,
  CategoryRepository,
  TagRepository,
} from "@/server/repositories/interfaces/taxonomy-repository";
import type { VersionRepository } from "@/server/repositories/interfaces/version-repository";
import type { AuditRepository } from "@/server/repositories/interfaces/audit-port";
import { FirestoreArticleRepository } from "@/server/repositories/firestore/firestore-article-repository";
import {
  FirestoreAudienceRepository,
  FirestoreCategoryRepository,
  FirestoreTagRepository,
} from "@/server/repositories/firestore/firestore-taxonomy-repository";
import { FirestoreVersionRepository } from "@/server/repositories/firestore/firestore-version-repository";
import { FirestoreAuditRepository } from "@/server/repositories/firestore/firestore-audit-repository";
import { MemoryArticleRepository } from "@/server/repositories/memory/memory-article-repository";
import {
  MemoryAudienceRepository,
  MemoryCategoryRepository,
  MemoryTagRepository,
} from "@/server/repositories/memory/memory-taxonomy-repository";
import { MemoryVersionRepository } from "@/server/repositories/memory/memory-version-repository";
import { MemoryAuditRepository } from "@/server/repositories/memory/memory-audit-repository";
import { isFirestoreConfigured } from "@/server/composition/public-content";

export type AdminPersistence = {
  mode: "memory" | "firestore" | "unavailable";
  articles: ArticleRepository | null;
  categories: CategoryRepository | null;
  tags: TagRepository | null;
  audiences: AudienceRepository | null;
  versions: VersionRepository | null;
  audit: AuditRepository | null;
};

let memorySingleton: AdminPersistence | null = null;
let firestoreSingleton: AdminPersistence | null = null;

export function getAdminPersistence(): AdminPersistence {
  const mode = getPersistenceMode();
  const env = getServerEnv();

  if (mode === "memory") {
    if (env.NODE_ENV === "production") {
      return {
        mode: "unavailable",
        articles: null,
        categories: null,
        tags: null,
        audiences: null,
        versions: null,
        audit: null,
      };
    }
    if (!memorySingleton) {
      memorySingleton = {
        mode: "memory",
        articles: new MemoryArticleRepository(),
        categories: new MemoryCategoryRepository(),
        tags: new MemoryTagRepository(),
        audiences: new MemoryAudienceRepository(),
        versions: new MemoryVersionRepository(),
        audit: new MemoryAuditRepository(),
      };
    }
    return memorySingleton;
  }

  if (!isFirestoreConfigured()) {
    return {
      mode: "unavailable",
      articles: null,
      categories: null,
      tags: null,
      audiences: null,
      versions: null,
      audit: null,
    };
  }

  if (!firestoreSingleton) {
    firestoreSingleton = {
      mode: "firestore",
      articles: new FirestoreArticleRepository(),
      categories: new FirestoreCategoryRepository(),
      tags: new FirestoreTagRepository(),
      audiences: new FirestoreAudienceRepository(),
      versions: new FirestoreVersionRepository(),
      audit: new FirestoreAuditRepository(),
    };
  }
  return firestoreSingleton;
}

export function resetAdminPersistenceForTests(): void {
  memorySingleton = null;
  firestoreSingleton = null;
}
