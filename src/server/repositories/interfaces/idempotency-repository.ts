export type IdempotencyRecord = {
  keyHash: string;
  operation: string;
  result: Record<string, unknown>;
  createdAt: string;
};

export interface IdempotencyRepository {
  getByKey(idempotencyKey: string): Promise<IdempotencyRecord | null>;
  saveIfAbsent(record: {
    idempotencyKey: string;
    operation: string;
    result: Record<string, unknown>;
    createdAt: string;
  }): Promise<{ created: boolean; record: IdempotencyRecord }>;
}
