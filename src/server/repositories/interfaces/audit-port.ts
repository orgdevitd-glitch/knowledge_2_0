import type { AuditEvent } from "@/domain/content/audit";

/** Port for audit events. Persistence adapter is chosen later. */
export interface AuditPort {
  append(event: AuditEvent): Promise<void>;
}

export interface AuditRepository extends AuditPort {
  listByEntity(entityType: string, entityId: string): Promise<AuditEvent[]>;
}
