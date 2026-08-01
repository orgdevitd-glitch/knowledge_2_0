import "server-only";

import type { ImportJob } from "@/domain/integrations/import-job";
import { parseImportJob } from "@/domain/integrations/import-job";
import { RepositoryError } from "@/domain/shared/errors";
import { getFirebaseAdminFirestore } from "@/server/firebase/admin";
import type { ImportJobRepository } from "@/server/repositories/interfaces/import-job-repository";
import { FIRESTORE_COLLECTIONS, FIRESTORE_SCHEMA_VERSION } from "./collections";

function toImportJobDoc(job: ImportJob): Record<string, unknown> {
  return {
    schemaVersion: FIRESTORE_SCHEMA_VERSION,
    ...JSON.parse(JSON.stringify(job)),
  };
}

function fromImportJobDoc(docId: string, raw: unknown): ImportJob {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new RepositoryError("Invalid ImportJob document");
  }
  const data = raw as Record<string, unknown>;
  if (data.schemaVersion !== FIRESTORE_SCHEMA_VERSION) {
    throw new RepositoryError("Unsupported ImportJob schema version");
  }
  const rest = { ...data };
  delete rest.schemaVersion;
  const job = parseImportJob(rest);
  if (job.id !== docId) {
    throw new RepositoryError("ImportJob document id mismatch");
  }
  return job;
}

export class FirestoreImportJobRepository implements ImportJobRepository {
  private col() {
    return getFirebaseAdminFirestore().collection(
      FIRESTORE_COLLECTIONS.importJobs,
    );
  }

  async getById(id: string): Promise<ImportJob | null> {
    try {
      const snap = await this.col().doc(id).get();
      if (!snap.exists) return null;
      return fromImportJobDoc(snap.id, snap.data());
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw new RepositoryError("Failed to read ImportJob", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async save(job: ImportJob): Promise<ImportJob> {
    const ref = this.col().doc(job.id);
    try {
      await ref.set(toImportJobDoc(job), { merge: false });
      return job;
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError("Failed to save ImportJob", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async listRecent(limit = 50): Promise<ImportJob[]> {
    try {
      const snap = await this.col()
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
      return snap.docs.map((doc) => fromImportJobDoc(doc.id, doc.data()));
    } catch (error) {
      throw new RepositoryError("Failed to list ImportJobs", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}
