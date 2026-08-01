import "server-only";

import { getMediaLimits } from "@/config/media-env";
import { getPersistenceMode } from "@/config/env";
import type { MediaRepository } from "@/server/repositories/interfaces/media-repository";
import type { MediaStoragePort } from "@/server/repositories/interfaces/media-storage-port";
import { MemoryMediaRepository } from "@/server/repositories/memory/memory-media-repository";
import { MemoryMediaStorage } from "@/server/repositories/memory/memory-media-storage";
import { FirestoreMediaRepository } from "@/server/repositories/firestore/firestore-media-repository";
import { GcsMediaStorageAdapter } from "@/server/storage/gcs-media-storage";
import { RepositoryError } from "@/domain/shared/errors";

let memoryMediaRepo: MemoryMediaRepository | null = null;
let memoryStorage: MemoryMediaStorage | null = null;

export function getMediaRepository(): MediaRepository {
  const mode = getPersistenceMode();
  if (mode === "memory") {
    memoryMediaRepo ??= new MemoryMediaRepository();
    return memoryMediaRepo;
  }
  return new FirestoreMediaRepository();
}

export function getMediaStorage(): MediaStoragePort {
  const limits = getMediaLimits();
  if (limits.storageMode === "memory") {
    memoryStorage ??= new MemoryMediaStorage();
    return memoryStorage;
  }
  if (!limits.bucketName) {
    throw new RepositoryError("Media GCS bucket is not configured", {
      adminCode: "PERSISTENCE_UNAVAILABLE",
    });
  }
  return new GcsMediaStorageAdapter(limits.bucketName);
}

export function getMemoryMediaRepositoryForTests(): MemoryMediaRepository {
  memoryMediaRepo ??= new MemoryMediaRepository();
  return memoryMediaRepo;
}

export function getMemoryMediaStorageForTests(): MemoryMediaStorage {
  memoryStorage ??= new MemoryMediaStorage();
  return memoryStorage;
}

export function resetMediaCompositionForTests(): void {
  memoryMediaRepo = null;
  memoryStorage = null;
}
