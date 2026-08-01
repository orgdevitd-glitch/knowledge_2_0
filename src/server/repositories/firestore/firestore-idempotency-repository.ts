import "server-only";

import { createHash } from "node:crypto";

import { RepositoryError } from "@/domain/shared/errors";
import { getFirebaseAdminFirestore } from "@/server/firebase/admin";
import { FIRESTORE_COLLECTIONS, FIRESTORE_SCHEMA_VERSION } from "./collections";

import type {
  IdempotencyRecord,
  IdempotencyRepository,
} from "@/server/repositories/interfaces/idempotency-repository";

function hashIdempotencyKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function toIdempotencyDoc(record: IdempotencyRecord): Record<string, unknown> {
  return {
    schemaVersion: FIRESTORE_SCHEMA_VERSION,
    ...record,
  };
}

function fromIdempotencyDoc(raw: unknown): IdempotencyRecord {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new RepositoryError("Invalid idempotency record");
  }
  const data = raw as Record<string, unknown>;
  if (data.schemaVersion !== FIRESTORE_SCHEMA_VERSION) {
    throw new RepositoryError("Unsupported idempotency schema version");
  }
  return {
    keyHash: String(data.keyHash),
    operation: String(data.operation),
    result: (data.result as Record<string, unknown>) ?? {},
    createdAt: String(data.createdAt),
  };
}

export class FirestoreIdempotencyRepository implements IdempotencyRepository {
  private col() {
    return getFirebaseAdminFirestore().collection(
      FIRESTORE_COLLECTIONS.idempotencyRecords,
    );
  }

  async getByKey(idempotencyKey: string): Promise<IdempotencyRecord | null> {
    const keyHash = hashIdempotencyKey(idempotencyKey);
    try {
      const snap = await this.col().doc(keyHash).get();
      if (!snap.exists) return null;
      return fromIdempotencyDoc(snap.data());
    } catch (error) {
      throw new RepositoryError("Failed to read idempotency record", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async saveIfAbsent(record: {
    idempotencyKey: string;
    operation: string;
    result: Record<string, unknown>;
    createdAt: string;
  }): Promise<{ created: boolean; record: IdempotencyRecord }> {
    const keyHash = hashIdempotencyKey(record.idempotencyKey);
    const ref = this.col().doc(keyHash);
    const payload: IdempotencyRecord = {
      keyHash,
      operation: record.operation,
      result: record.result,
      createdAt: record.createdAt,
    };

    try {
      let created = false;
      await getFirebaseAdminFirestore().runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (current.exists) {
          return;
        }
        tx.create(ref, toIdempotencyDoc(payload));
        created = true;
      });

      const saved = await this.getByKey(record.idempotencyKey);
      if (!saved) {
        throw new RepositoryError("Idempotency record missing after write");
      }
      return { created, record: saved };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: number }).code === 6
      ) {
        const existing = await this.getByKey(record.idempotencyKey);
        if (existing) {
          return { created: false, record: existing };
        }
      }
      throw new RepositoryError("Failed to save idempotency record", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}

export { hashIdempotencyKey };
