import "server-only";

import type { AuditEvent } from "@/domain/content/audit";
import { RepositoryError } from "@/domain/shared/errors";
import type { AuditRepository } from "@/server/repositories/interfaces/audit-port";
import { getFirebaseAdminFirestore } from "@/server/firebase/admin";
import { FIRESTORE_COLLECTIONS } from "./collections";
import { fromAuditDoc, toAuditDoc } from "./mappers";

export class FirestoreAuditRepository implements AuditRepository {
  private col() {
    return getFirebaseAdminFirestore().collection(
      FIRESTORE_COLLECTIONS.auditEvents,
    );
  }

  async append(event: AuditEvent): Promise<void> {
    try {
      await this.col().doc(event.id).create(toAuditDoc(event));
    } catch (error) {
      throw new RepositoryError("Failed to append audit event", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async listByEntity(
    entityType: string,
    entityId: string,
  ): Promise<AuditEvent[]> {
    const snap = await this.col()
      .where("entityType", "==", entityType)
      .where("entityId", "==", entityId)
      .limit(100)
      .get();
    return snap.docs.map((d) => fromAuditDoc(d.id, d.data()));
  }
}
