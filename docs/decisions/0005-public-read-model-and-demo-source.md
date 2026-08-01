# ADR 0005 — Public read model and demo source

## Status

Accepted

## Context

Phase 4 needs a public vertical slice before Firestore. Demo content is required for development, but must never appear in production.

## Decisions

1. Separate **public read models** from domain entities.
2. **Composition root** selects `empty` or `demo` `PublicContentSource`.
3. Production defaults to **empty**; **demo forbidden** in production via Zod env.
4. Central **published-only** visibility policy.
5. Server-first rendering; client only for nav panel and copy.
6. URL-based catalog filters and pagination.
7. In-process deterministic search with centralized weights.
8. Block **renderer registry** for all 22 types; media via unavailable resolver.
9. No mutation APIs in Phase 4.

## Consequences

Firestore adapters can replace the source without changing public routes or DTOs. Demo fixtures stay server-only and validated.
