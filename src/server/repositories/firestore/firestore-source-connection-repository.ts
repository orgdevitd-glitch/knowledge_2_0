import "server-only";

import type { SourceConnection } from "@/domain/integrations/source-connection";
import { parseSourceConnection } from "@/domain/integrations/source-connection";
import {
  ConflictError,
  RepositoryError,
} from "@/domain/shared/errors";
import { getFirebaseAdminFirestore } from "@/server/firebase/admin";
import type { SourceConnectionRepository } from "@/server/repositories/interfaces/source-connection-repository";
import { FIRESTORE_COLLECTIONS, FIRESTORE_SCHEMA_VERSION } from "./collections";

function toSourceConnectionDoc(
  connection: SourceConnection,
): Record<string, unknown> {
  return {
    schemaVersion: FIRESTORE_SCHEMA_VERSION,
    ...JSON.parse(JSON.stringify(connection)),
  };
}

function fromSourceConnectionDoc(docId: string, raw: unknown): SourceConnection {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new RepositoryError("Invalid SourceConnection document");
  }
  const data = raw as Record<string, unknown>;
  if (data.schemaVersion !== FIRESTORE_SCHEMA_VERSION) {
    throw new RepositoryError("Unsupported SourceConnection schema version");
  }
  const rest = { ...data };
  delete rest.schemaVersion;
  const connection = parseSourceConnection(rest);
  if (connection.id !== docId) {
    throw new RepositoryError("SourceConnection document id mismatch");
  }
  return connection;
}

export class FirestoreSourceConnectionRepository
  implements SourceConnectionRepository
{
  private col() {
    return getFirebaseAdminFirestore().collection(
      FIRESTORE_COLLECTIONS.sourceConnections,
    );
  }

  async getById(id: string): Promise<SourceConnection | null> {
    try {
      const snap = await this.col().doc(id).get();
      if (!snap.exists) return null;
      return fromSourceConnectionDoc(snap.id, snap.data());
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw new RepositoryError("Failed to read SourceConnection", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async getByExternalId(externalId: string): Promise<SourceConnection | null> {
    try {
      const snap = await this.col()
        .where("externalId", "==", externalId)
        .limit(1)
        .get();
      if (snap.empty) return null;
      const doc = snap.docs[0]!;
      return fromSourceConnectionDoc(doc.id, doc.data());
    } catch (error) {
      throw new RepositoryError("Failed to read SourceConnection by externalId", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async save(
    connection: SourceConnection,
    expectedRevision: number,
  ): Promise<SourceConnection> {
    const ref = this.col().doc(connection.id);
    try {
      await getFirebaseAdminFirestore().runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (!current.exists) {
          if (expectedRevision !== 0) {
            throw new ConflictError(
              "Cannot create SourceConnection with non-zero expected revision",
            );
          }
        } else {
          const existing = fromSourceConnectionDoc(current.id, current.data());
          if (existing.revision !== expectedRevision) {
            throw new ConflictError("SourceConnection optimistic concurrency conflict", {
              expectedRevision,
              actualRevision: existing.revision,
            });
          }
        }
        tx.set(ref, toSourceConnectionDoc(connection), { merge: false });
      });
      return connection;
    } catch (error) {
      if (error instanceof ConflictError || error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError("Failed to save SourceConnection", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async listActive(limit = 100): Promise<SourceConnection[]> {
    try {
      const snap = await this.col()
        .where("status", "==", "active")
        .limit(limit)
        .get();
      return snap.docs.map((doc) => fromSourceConnectionDoc(doc.id, doc.data()));
    } catch (error) {
      throw new RepositoryError("Failed to list SourceConnections", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async listRecent(limit = 100): Promise<SourceConnection[]> {
    try {
      const snap = await this.col()
        .orderBy("updatedAt", "desc")
        .limit(limit)
        .get();
      return snap.docs.map((doc) => fromSourceConnectionDoc(doc.id, doc.data()));
    } catch (error) {
      throw new RepositoryError("Failed to list recent SourceConnections", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}
