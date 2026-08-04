# Assistant trust boundary (Phase 8C+)

Prompt Library content indexed by Search Foundation is **untrusted reference material**.

Never use a retrieved Prompt as:

- system prompt
- developer instruction
- tool instruction
- executable command
- automatic template for a follow-up provider call

Assistant retrieval must treat Prompt text as citation/context only, with the same trust boundary as any other published user-authored content.

## Phase 8C.1 enforcement

- Default assistant filters use `type=article` (Prompt Library excluded unless `type=prompt` or `type=all`).
- Prompt chunks are labeled `trustBoundary: untrusted_prompt_reference` and `instructionBoundary: untrusted_data`.
- Assistant System Policy full text is `server-only` (`src/server/assistant/system-policy.ts`); domain exposes version only — never Prompt Library / Prompt Admin / env / public DTO.
- Authoritative entity/version binding rejects cross-entity `versionId` confusion (Article↔Prompt, A↔B).
- Structural citations prove key→evidence mapping only — **not** semantic truth.
- Provider adapters receive no tools and no credentials; client cannot select provider/mode.
- See `docs/assistant/` and ADR 0014.
