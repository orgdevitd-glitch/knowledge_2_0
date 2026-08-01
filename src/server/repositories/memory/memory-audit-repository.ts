import type { AuditEvent } from "@/domain/content/audit";
import type { AuditRepository } from "../interfaces/audit-port";
import { deepClone, MEMORY_REPOSITORY_MARKER } from "./memory-store";

export class MemoryAuditRepository implements AuditRepository {
  readonly marker = MEMORY_REPOSITORY_MARKER;
  private readonly events: AuditEvent[] = [];

  append(event: AuditEvent) {
    this.events.push(deepClone(event));
    return Promise.resolve();
  }

  listByEntity(entityType: string, entityId: string) {
    return Promise.resolve(
      this.events
        .filter((e) => e.entityType === entityType && e.entityId === entityId)
        .map((e) => deepClone(e)),
    );
  }

  clear() {
    this.events.length = 0;
  }
}
