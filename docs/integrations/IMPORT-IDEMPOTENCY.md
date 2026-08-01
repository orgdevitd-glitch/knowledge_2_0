# Import idempotency

Confirm operations use `idempotencyKey` derived from import job id, source id/version, target, and operation. Hashed key is stored in `idempotencyRecords/{hash}`.

Repeated POST returns the prior result and does not create duplicate Articles/Prompts. Confirmed jobs cannot be confirmed with different parameters.
