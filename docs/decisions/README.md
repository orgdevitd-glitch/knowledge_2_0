# Architecture Decision Records

This directory is the journal of architectural decisions for the Corporate Knowledge Portal.

## How to write an ADR

1. Copy `TEMPLATE.md` to `NNNN-short-title.md` (monotonic number).
2. Fill Context, Decision, Consequences.
3. Link related docs/PRs.
4. Do not rewrite history — supersede with a new ADR instead.

## Index

| ID | Title | Status |
|----|-------|--------|
| 0001 | Phase 0 bootstrap baselines | Accepted |
| 0002 | Phase 1 foundation stack | Accepted |
| 0003 | Phase 2B production design system | Accepted |
| 0004 | Content domain model | Accepted |
| 0005 | Public read model and demo source | Accepted |
| 0006 | Firebase admin session and Firestore | Accepted |
| 0007 | Admin article editor | Accepted |
| 0008 | Google Workspace manual import | Accepted |
| 0009 | Taxonomy administration | Accepted |
| 0010 | Prompt administration | Accepted |
| 0011 | Media Library (Phase 7B) | Accepted |
| 0012 | Search Foundation (Phase 8B.1) | Accepted |
| 0013 | Search Experience (Phase 8B.2) | Accepted |

## When an ADR is required

- New brand color or design-system break
- New infrastructure dependency or search platform
- Two-way Google sync or widened OAuth scopes
- Auth model changes
- Deviation from layered architecture
- Introducing a UI library (after `pick-ui-library`)
