import type {
  IdempotencyRecord,
  IdempotencyRepository,
} from "@/server/repositories/interfaces/idempotency-repository";
import { hashIdempotencyKey } from "@/server/repositories/firestore/firestore-idempotency-repository";

export class MemoryIdempotencyRepository implements IdempotencyRepository {
  private readonly byHash = new Map<string, IdempotencyRecord>();

  async getByKey(idempotencyKey: string): Promise<IdempotencyRecord | null> {
    return this.byHash.get(hashIdempotencyKey(idempotencyKey)) ?? null;
  }

  async saveIfAbsent(record: {
    idempotencyKey: string;
    operation: string;
    result: Record<string, unknown>;
    createdAt: string;
  }): Promise<{ created: boolean; record: IdempotencyRecord }> {
    const keyHash = hashIdempotencyKey(record.idempotencyKey);
    const existing = this.byHash.get(keyHash);
    if (existing) {
      return { created: false, record: existing };
    }
    const payload: IdempotencyRecord = {
      keyHash,
      operation: record.operation,
      result: record.result,
      createdAt: record.createdAt,
    };
    this.byHash.set(keyHash, payload);
    return { created: true, record: payload };
  }

  clearForTests(): void {
    this.byHash.clear();
  }
}
