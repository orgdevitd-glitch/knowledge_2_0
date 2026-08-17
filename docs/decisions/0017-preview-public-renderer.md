# ADR 0017: Shared public/preview renderer

## Title

0017: Shared public and admin-preview read model

## Status

Accepted

## Date

2026-08-17

## Context

Phase 8E.2 needs admin article/prompt preview to match the published public page: TOC, taxonomy, related materials, and media. The previous preview routes rendered a stub (`ArticleBlocks` with empty TOC/related/prompt lookup, no media hydration, duplicated prompt JSX). A second presentational renderer would drift immediately.

Public pages already build `ArticleDetail` / `PromptDetail` from published snapshots. Admin preview must show the **current draft body** of the edited material without exposing other unpublished drafts through related/prompt/media hydration.

## Decision

1. Extract `buildArticleDetail` / `buildPromptDetail` (`src/features/public-content/build-detail.ts`) so both published queries and admin preview feed the same read model.
2. Public and preview routes render the same presentational components: `ArticlePublicView` and `PromptPublicView`.
3. Preview may differ only in source (working copy vs published snapshot), admin chrome, the «Предпросмотр черновика» banner, auth, and `noindex`.
4. Related materials, prompt-block lookup, and media hydration stay on the **published / public** boundary: unpublished, hidden, archived, or missing peers are omitted (or media fallback), never leaked as other drafts.
5. Catalog tag/category/audience links use `/materials?…=<slug>` (catalog contract). Search Experience keeps ID-based `?tag=` / `?category=` / `?audience=` (ADR 0013). Do not unify those contracts in this slice.

## Consequences

Positive: one renderer, TOC/media/related in preview, honest review status and public tags without a new stored schema.

Negative: catalog slug filters and search ID filters remain different; editors must not assume a tag chip URL is a Search URL.

Follow-up: Gemini/provider still deferred; Video admin and Google 6B unchanged.

## Alternatives considered

- Duplicate JSX in preview routes — rejected (already drifted).
- Hydrate related drafts in preview — rejected (would leak unpublished peers).
- New `/tags/[slug]` landing pages — rejected (out of scope; catalog filter is enough).
